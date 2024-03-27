/*eslint-env browser*/

// Render the PayPal marks
//window.paypal.Marks().render('#paypal-marks-container');
// Render the PayPal buttons
//window.paypal.Buttons().render('#paypal-button-container');

// Listen for changes to the radio buttons
document.querySelectorAll('input[name=payment-option]')
  .forEach(function (el) {
    el.addEventListener('change', function (event) {
      // If PayPal is selected, show the PayPal button
      if (event.target.value === 'paypal') {
        document.body.querySelector('#alternate-button-container')
          .style.display = 'none';
        document.body.querySelector('#paypal-button-container')
          .style.display = 'block';
      }
      // If alternate funding is selected, show a different button
      if (event.target.value === 'alternate') {
        document.body.querySelector('#alternate-button-container')
          .style.display = 'block';
        document.body.querySelector('#paypal-button-container')
          .style.display = 'none';
      }
    });
  });
// Hide non-PayPal button by default
document.body.querySelector('#alternate-button-container')
  .style.display = 'none';

let fundingSource

window.paypal
  .Buttons({
    onClick: (data) => {
      // fundingSource = "venmo"
      fundingSource = data.fundingSource
      resultMessage(`Funding Source changed to ${fundingSource}`);
    },
    async createOrder() {
      try {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          // use the "body" param to optionally pass additional order information
          // like product ids and quantities
          body: JSON.stringify({
            cart: [
              {
                id: "YOUR_PRODUCT_ID",
                quantity: "1",
              },
            ],
          }),
        });

        const orderData = await response.json();

        if (orderData.id) {
          return orderData.id;
        } else {
          const errorDetail = orderData?.details?.[0];
          const errorMessage = errorDetail
            ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
            : JSON.stringify(orderData);

          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error(error);
        resultMessage(`Could not initiate PayPal Checkout...<br><br>${error}`);
      }
    },
    async onApprove(data, actions) {
      try {
        const response = await fetch(`/api/orders/${data.orderID}/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const orderData = await response.json();
        // Three cases to handle:
        //   (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
        //   (2) Other non-recoverable errors -> Show a failure message
        //   (3) Successful transaction -> Show confirmation or thank you message

        const errorDetail = orderData?.details?.[0];

        if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
          // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
          // recoverable state, per https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
          return actions.restart();
        } else if (errorDetail) {
          // (2) Other non-recoverable errors -> Show a failure message
          throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
        } else if (!orderData.purchase_units) {
          throw new Error(JSON.stringify(orderData));
        } else {
          // (3) Successful transaction -> Show confirmation or thank you message
          // Or go to another URL:  actions.redirect('thank_you.html');
          const transaction =
            orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
            orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
          resultMessage(
            `Transaction ${transaction.status}: ${transaction.id}<br><br>See console for all available details`,
          );
          console.log(
            "Capture result",
            orderData,
            JSON.stringify(orderData, null, 2),
          );
        }
      } catch (error) {
        console.error(error);
        resultMessage(
          `Sorry, your transaction could not be processed...<br><br>${error}`,
        );
      }
    },
  })
  .render("#paypal-button-container");

// Example function to show a result to the user. Your site's UI library can be used instead.
function resultMessage(message) {
  const container = document.querySelector("#result-message");
  container.innerHTML = message;
}
