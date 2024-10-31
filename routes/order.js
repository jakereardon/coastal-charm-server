const express = require('express');
const router = express.Router();

require("dotenv").config();
const apiPrefix = process.env.API_PREFIX;
const mailPassword = process.env.MAIL_PWD;

const stripe = require('stripe')(process.env.STRIPE_SECRET);
const { MongoClient} = require("mongodb");
const nodemailer = require("nodemailer");
const { createCanvas, loadImage } = require('canvas');

const mongoClient = new MongoClient(process.env.MONGODB_URI);

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: "noreply@coastalcharmnh.com",
    pass: mailPassword,
  }
});

router.get(apiPrefix + "/charms", async (req, res) => {
  res.json(
    await mongoClient.db("inventory").collection("charms").find().toArray()
  );

});

router.get(apiPrefix + "/chains", async (req, res) => {
  res.json(
    await mongoClient.db("inventory").collection("chains").find().toArray()
  );
});

function computeItemCost(item) {
  const charmsCost = item.charms.reduce((totalCost, charm) => totalCost + charm.price, 0);
  const lengthIndex = item.lengthIndex;
  const chainPrice = item.chain.price[lengthIndex];

  return chainPrice + charmsCost;
}

function computeCartCost(cart) {
  return cart.reduce((totalCost, item) => totalCost + computeItemCost(item), 0);
}

function generateItemImage(item, clientWidth, clientHeight) {
  const canvasWidth = 1000;
  const canvasHeight = 1000;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  return loadImage(item.chain.imgUrl)
    .then(function(img) {
      const ratio = img.naturalWidth / img.naturalHeight;
      const height = canvasHeight * 0.8;
      const width = height * ratio;
      const x = canvasWidth / 2 - width / 2;
      ctx.drawImage(img, x, 0, width, height);
    })
    .then(function() {
      return Promise.all(item.charms.map(function(charm) {
        return loadImage(charm.iconUrl);
      }));
    })
    .then(function(imgPromises) {
      imgPromises.forEach(function(img, i) {
        const centerXCanvas = canvasWidth / 2;
        const distFromCenterXClient = item.charms[i].x - clientWidth / 2;
        const x = centerXCanvas + distFromCenterXClient * canvasWidth / clientWidth;

        const y = item.charms[i].y / clientHeight * canvasHeight;
        ctx.drawImage(img, x, y, 100, 100);
      });
    })
    .then(() => {
      return canvas;
    })
    .catch(err => console.log(err));
}

function formatJsonShipping(shipping) {
  return `
    <b>Shipping Address</b>
    <div>${shipping.name}</div>
    <div>${shipping.address.line1}</div>
    ${shipping.address.line2 ? '<div>' + shipping.address.line2 + '</div>': ''}
    <div>${shipping.address.state}, ${shipping.address.postal_code}</div>
  `;
}

router.post(apiPrefix + "/create-confirm-intent", async (req, res) => {
  const items = req.body.items;
  const totalCost = computeCartCost(items) + 10;

  try {
    // create and confirm Stripe payment intent
    const intent = await stripe.paymentIntents.create({
      confirm: true,
      amount: totalCost * 100,
      currency: "usd",
      confirmation_token: req.body.confirmationTokenId,
      return_url: "http://localhost:3000/gallery"
    });

    
    Promise.all(items.map(i => generateItemImage(i, req.body.clientWidth, req.body.clientHeight)))
      .then(function(images) {
        const imageAttachments = images.map(function(image, i) {
          
          return {
            filename: "item-" + i + ".png",
            content: image.createPNGStream(),
            cid: "item-" + i,
          }
        });

        const html = formatJsonShipping(intent.shipping) + items.map(function(item, i) {
          return `
            <div>
              <br/>
              <div>${item.chain.alt}: ${item.chain.price}</div>
              <div>${item.charms.map(c => c.alt + ": " + c.price)}</div>
              <img width="512" src="cid:item-${i}"/>
            </div>
          `;
        }).join("\n");

        const mailOptions = {
          from: "noreply@coastalcharmnh.com",
          to: "jakereardon13@gmail.com",
          subject: "New Order #" + intent.id,
          html: html,
          attachments: imageAttachments
        }

        transporter.sendMail(mailOptions, (err, info) => {
          if (err) console.log(err);
        });
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