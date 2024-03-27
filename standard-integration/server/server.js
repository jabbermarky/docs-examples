/*eslint-env node*/
import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import path from "path";


const base = "https://api-m.sandbox.paypal.com";
const app = express();

const PORT = 8888;
const PAYPAL_CLIENT_ID = process.env.CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.CLIENT_SECRET;

const clientId = PAYPAL_CLIENT_ID;
const merchantIDOrEmail = "sb-ibu2729522887@business.example.com";
const auth1 = Buffer.from('{"alg":"none"}').toString("base64");
const auth2 = Buffer.from(`{"iss":${clientId},"payer_id":${merchantIDOrEmail}}`).toString("base64");
const authAssertionHeader = `${auth1}.${auth2}.`;
/*
const sellerPayerId = "sb-ibu2729522887@business.example.com";
const jwt = getAuthAssertionValue(clientId, sellerPayerId);

console.log("jwt=",jwt);
function getAuthAssertionValue(clientId, sellerPayerId) {
    const header = {
        "alg": "none"
    };
    const encodedHeader = base64url(header);
    const payload = {
        "iss": clientId,
        "payer_id": sellerPayerId
    };
    const encodedPayload = base64url(payload);
    return `${encodedHeader}.${encodedPayload}.`;
}
function base64url(json) {
    return btoa(JSON.stringify(json))
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}
*/

// host static files
app.use(express.static("client"));

// parse post params sent in body in json format
app.use(express.json());

/**
 * Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
 * @see https://developer.paypal.com/api/rest/authentication/
 */
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET,
    ).toString("base64");
    //console.log("auth=",auth);
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    //console.log("got access token:", data);
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
  }
};

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (cart) => {
  // use the cart information passed from the front-end to calculate the purchase unit details
  console.log(
    "createOrder: shopping cart information passed from the frontend createOrder() callback:",
    cart,
  );

  const accessToken = await generateAccessToken();
  //console.log("createOrder: accessToken=", accessToken);
  const url = `${base}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: "1.00",
        },
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      //"PayPal-Partner-Attribution-Id": "BN-CODE",
      "PayPal-Auth-Assertion": `${authAssertionHeader}`
    },
    method: "POST",
    body: JSON.stringify(payload),
  });
  console.log("createOrder: response=", response);
  return handleResponse(response);
};

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      "PayPal-Partner-Attribution-Id": "BN-CODE",
      "PayPal-Auth-Assertion": `${authAssertionHeader}`
    },
  });

  return handleResponse(response);
};

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

app.post("/api/orders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

// serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.resolve("./client/checkout.html"));
});

app.listen(PORT, () => {
  console.log(`Node server listening at http://localhost:${PORT}/`);
});


