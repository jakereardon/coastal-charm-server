const express = require("express");

const app = express();
const port = 8000;

// import routes
const homeRouter = require("./routes/home");
const galleryRouter = require("./routes/gallery");
const bookRouter = require("./routes/book");
const orderRouter = require("./routes/order");

// json middleware
app.use(express.json());

app.use(homeRouter);
app.use(galleryRouter);
app.use(bookRouter);
app.use(orderRouter);

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});