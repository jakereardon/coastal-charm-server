const express = require('express');
const router = express.Router();

require("dotenv").config();
const apiPrefix = process.env.API_PREFIX;
const mailPassword = process.env.MAIL_PWD;

const stripe = require('stripe')(process.env.STRIPE_SECRET);
const { MongoClient} = require("mongodb");
const nodemailer = require("nodemailer");
const { createCanvas, loadImage } = require('canvas');

// connect to MongoDB
const mongoClient = new MongoClient(process.env.MONGODB_URI);

// transporter to send mail
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: "noreply@coastalcharmnh.com",
    pass: mailPassword,
  }
});

async function getShippingCost() {
  const constants = await mongoClient.db("business").collection("constants");
  const shipping = await constants.findOne({ field: "shippingCostInDollars" });
  return shipping.value;
}

router.get(apiPrefix + "/shippingCost", async (req, res) => {
  res.json({
    cost: await getShippingCost()
  });
});

router.get(apiPrefix + "/charms", async (req, res) => {
  // gets available draggable foreground items
  res.json(
    await mongoClient.db("inventory").collection("charms").find().toArray()
  );

});

router.get(apiPrefix + "/chains", async (req, res) => {
  // gets availible background items
  res.json(
    await mongoClient.db("inventory").collection("chains").find().toArray()
  );
});

function computeItemCost(item) {
  // compute the cost of a single item in the cart
  const charmsCost = item.charms.reduce((totalCost, charm) => totalCost + charm.price, 0);
  const lengthIndex = item.lengthIndex;
  const chainPrice = item.chain.price[lengthIndex]; // get price of the correct length chain

  return chainPrice + charmsCost;
}

function computeCartCost(cart) {
  // compute the total cost of the cart
  return cart.reduce((totalCost, item) => totalCost + computeItemCost(item), 0);
}

function generateItemImage(item, clientWidth, clientHeight) {
  // reconstructs the customer's designed item to be sent to business owners
  const canvasWidth = clientWidth;
  const canvasHeight = clientHeight;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  return loadImage(item.chain.imgUrl)
    .then(function(img) {
      // draw the background item on the canvas
      const ratio = img.naturalWidth / img.naturalHeight;
      const height = canvasHeight * 0.8; // image is scaled by 80% on client browser
      const width = height * ratio;
      const x = canvasWidth / 2 - width / 2;
      ctx.drawImage(img, x, 0, width, height);
    })
    .then(function() {
      // load all foreground draggable items on the canvas
      return Promise.all(item.charms.map(function(charm) {
        return loadImage(charm.iconUrl);
      }))
    })
    .then(function(imgPromises) {
      // draw all foreground draggable items on the canvas
      imgPromises.forEach(function(img, i) {
        const ratio = img.naturalWidth / img.naturalHeight;
        const width = item.charms[i].width;
        const height = item.charms[i].width / ratio;

        ctx.drawImage(img, item.charms[i].x, item.charms[i].y, width, height);
      });
    })
    .then(() => {
      return canvas;
    })
    .catch(err => console.log(err));
}

function formatJsonShipping(shipping, email) {
  return `
    <b>Shipping Address</b>
    <div>${shipping.name}</div>
    <div>${shipping.address.line1}</div>
    ${shipping.address.line2 ? '<div>' + shipping.address.line2 + '</div>': ''}
    <div>${shipping.address.state}, ${shipping.address.postal_code}</div>
    <div>${email}</div>
  `;
}

router.post(apiPrefix + "/create-confirm-intent", async (req, res) => {
  const centsPerDollar = 100;

  const items = req.body.items;
  const totalCost = computeCartCost(items) + 6;

  try {
    // create and confirm Stripe payment intent
    const intent = await stripe.paymentIntents.create({
      confirm: true,
      amount: totalCost * centsPerDollar,
      currency: "usd",
      confirmation_token: req.body.confirmationTokenId,
      return_url: "http://localhost:3000/gallery"
    });

    // send an email to business owners with order information
    Promise.all(items.map(i => generateItemImage(i, req.body.clientWidth, req.body.clientHeight)))
      // add each item image to email
      .then(function(images) {
        const imageAttachments = images.map(function(image, i) {
          return {
            filename: "item-" + i + ".png",
            content: image.createPNGStream(),
            cid: "item-" + i,
          }
        });

        // add shipping address, formatted for HTML email
        const html = formatJsonShipping(intent.shipping, req.body.email)
          + "<div> Notes: " + req.body.notes + "</div>"
          + items.map(function(item, i) {
          return `
            <div>
              <br/>
              <div>${item.chain.alt}: $${item.chain.price[item.lengthIndex]}</div>
              <div>${item.charms.map(c => c.alt + ": $" + c.price).join(", ")}</div>
              <img width="512" src="cid:item-${i}"/>
            </div>
            #${intent.id}
          `;
        }).join("\n");

        const mailOptions = {
          from: "noreply@coastalcharmnh.com",
          to: "jakereardon13@gmail.com",
          subject: "Thanks for your order!",
          html: html,
          attachments: imageAttachments
        }

        // send the email
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) console.log(err);
        });
      });

      const customerMailOptions = {
        from: "noreply@coastalcharmnh.com",
        to: email,
        subject: "Thanks for your order!",
        html: html,
        attachments: imageAttachments
      }

      transporter.sendMail(customerMailOptions, (err, info) => {
        if (err) console.log(err);
      });
    
    res.json({
      client_secret: intent.client_secret,
      status: intent.status
    });
  } catch (err) {
    res.json({
      error: err
    });
    console.log(err)
  }
});

module.exports = router;