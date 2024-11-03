const express = require("express");

const app = express();
const port = 8000;

const galleryRouter = require("./routes/gallery");
const bookRouter = require("./routes/book");
const orderRouter = require("./routes/order");

app.use(express.json());

app.use(galleryRouter);
app.use(bookRouter);
app.use(orderRouter);

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});