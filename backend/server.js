
const express = require("express");
const helmet = require("helmet");
const pool = require("./db");

const app = express();

app.use(helmet());
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy", database: "connected" });
  } catch {
    res.status(503).json({ status: "unhealthy" });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description, price FROM products ORDER BY id"
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Unable to retrieve products" });
  }
});

app.post("/api/orders", async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0 ||
      items.length > 50) {
    return res.status(400).json({ error: "Invalid order items" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let total = 0;
    const validatedItems = [];

    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(productId) || productId <= 0 ||
          !Number.isInteger(quantity) || quantity < 1 ||
          quantity > 100) {
        throw new Error("Invalid product or quantity");
      }

      const result = await client.query(
        `SELECT id, name, price, stock
         FROM products WHERE id = $1 FOR UPDATE`,
        [productId]
      );

      if (!result.rowCount) throw new Error("Product not found");

      const product = result.rows[0];

      if (product.stock < quantity) {
        throw new Error("Insufficient stock");
      }

      total += Number(product.price) * quantity;
      validatedItems.push({ product, quantity });
    }

    const order = await client.query(
      "INSERT INTO orders(total) VALUES($1) RETURNING id",
      [total]
    );

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items(order_id, product_id, quantity, price)
         VALUES($1, $2, $3, $4)`,
        [order.rows[0].id, item.product.id,
         item.quantity, item.product.price]
      );

      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [item.quantity, item.product.id]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Order placed",
      orderId: order.rows[0].id
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

const port = process.env.PORT || 5000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port}`);
});

