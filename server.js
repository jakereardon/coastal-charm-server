require("dotenv").config();
const { createCanvas, loadImage } = require('canvas');
const fs = require("fs");

const { MongoClient} = require("mongodb");
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const port = 8000;

const mongoClient = new MongoClient(process.env.MONGODB_URI);

app.use(express.json());

function computeItemCost(item) {
  const charmsCost = item.charms.reduce((totalCost, charm) => totalCost + charm.price, 0);
  return item.chain.price + charmsCost;
}

function computeCartCost(cart) {
  return cart.reduce((totalCost, item) => totalCost + computeItemCost(item), 0);
}

function generateItemImage(item) {
  const canvasWidth = 1000;
  const canvasHeight = 1000;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d')

  return loadImage("https://cc-nh.nyc3.digitaloceanspaces.com/chains/necklace-one.png")
    .then(function(img) {
      const ratio = img.naturalWidth / img.naturalHeight;
      const height = canvasHeight * 0.8
      const width = height * 0.8 / ratio;
      const x = canvasWidth / 2 - width / 2;
      ctx.drawImage(img, x, 0, width, height);
    })
    .then(function() {
      return Promise.all(item.charms.map(function(charm) {
        return loadImage(charm.iconUrl)
      }));
    })
    .then(function(imgPromises) {
      imgPromises.forEach(function(img, i) {
        const x = (canvasWidth / 2 - 50) + (1440 / 2 - item.charms[i].x) * 1440 / canvasWidth;
        console.log(x);
        const y = item.charms[i].y / 744 * canvasHeight;
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
    <div>${shipping.name}</div>
    <div>${shipping.address.line1}</div>
    <div>${shipping.address.line2}</div>
    <div>${shipping.address.state}, ${shipping.address.postal_code}</div>
  `;
}

app.post("/create-confirm-intent", async (req, res) => {
  const items = req.body.items;
  const totalCost = computeCartCost(items);

  try {
    // create and confirm Stripe payment intent
    const intent = await stripe.paymentIntents.create({
      confirm: true,
      amount: totalCost * 100,
      currency: "usd",
      confirmation_token: req.body.confirmationTokenId,
      return_url: "http://localhost:3000"
    });

    
    Promise.all(items.map(i => generateItemImage(i)))
      .then(function(images) {
        const imageAttachments = images.map(function(image, i) {
          return {
            filename: "item-" + i + ".png",
            content: image.createPNGStream(),
            cid: "item-" + i,
          }
        });

        const html = items.map(function(item, i) {
          return `
            <div>
              ${formatJsonShipping(intent.shipping)}
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

app.get("/charms", async (req, res) => {
  res.json(
    await mongoClient.db("inventory").collection("charms").find().toArray()
  );

});

app.get("/chains", async (req, res) => {
  res.json(
    await mongoClient.db("inventory").collection("chains").find().toArray()
  );

});

function getFilenamesFromXML(xml) {
  const re = /<Key>gallery\/(.*?)<\/Key>/g;
  const matches = [...xml.matchAll(re)]

  return matches.filter(m => m[1]).map(m => "https://cc-nh.nyc3.digitaloceanspaces.com/gallery/" + m[1]);
}

app.get("/gallery/images", async(req, res) => {
  let imageFilenames;

  fetch("https://cc-nh.nyc3.digitaloceanspaces.com")
    .then(res => res.text())
    .then(xml => getFilenamesFromXML(xml))
    .then(fnames => {
      res.json({
        urls: fnames
      })
    });  
});

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: "noreply@coastalcharmnh.com",
    pass: "2xe^$nG]zHi&~L_",
  }
});

function formatJsonForMail(formJson) {
  var formattedInfo = "A new request for an event has been submitted: <br /><br />";
  // iterate through keys of form JSON 
  for (var field in formJson) { 
    formattedInfo += "<b>" + field + ":</b> " + formJson[field] + "<br /><br />";
  }

  return formattedInfo;
}

app.post("/book-form", (req, res) => {
  const formDataJson = req.body;

  res.sendStatus(201);

  const mailOptions = {
    from: "noreply@coastalcharmnh.com",
    to: "jakereardon13@gmail.com",
    subject: "Coastal Charm event request",
    html: formatJsonForMail(formDataJson)
  }

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.log(err);
  });
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
