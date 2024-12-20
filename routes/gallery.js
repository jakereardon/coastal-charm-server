const express = require('express');
const router = express.Router();

require("dotenv").config();
const apiPrefix = process.env.API_PREFIX;

function getFilenamesFromXML(xml) {
  // extract the filenames of each gallery image from buckets XML file
  const urlPrefix = "https://cc-nh.nyc3.digitaloceanspaces.com/gallery/";

  const re = /<Key>gallery\/(.*?)<\/Key>/g;
  const matches = [...xml.matchAll(re)].filter(m => m[1]);

  return matches.map(m => urlPrefix + m[1]);
}

router.get(apiPrefix + "/gallery/images", async(req, res) => {
  // get the URLS to the images to be shown in the gallery

  fetch("https://cc-nh.nyc3.digitaloceanspaces.com")
    .then(res => res.text())
    .then(xml => getFilenamesFromXML(xml))
    .then(fnames => {
      res.json({
        urls: fnames
      })
    });
});

module.exports = router;