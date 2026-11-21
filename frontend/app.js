
const API = "/api";

let cart = [];

async function loadProducts() {
  try {
    const response = await fetch(`${API}/products`);
    if (!response.ok) throw new Error("Unable to load products");

    const products = await response.json();

    document.getElementById("product-list").innerHTML =
      products.map(p => `
        <div class="product">
          <h3>${escapeHTML(p.name)}</h3>
          <p>${escapeHTML(p.description || "")}</p>
          <h4>₹${Number(p.price).toFixed(2)}</h4>
          <button onclick="addToCart(${Number(p.id)})">
            Add to Cart
          </button>
        </div>
      `).join("");
  } catch (error) {
    document.getElementById("product-list").textContent =
      "Products are temporarily unavailable.";
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function addToCart(id) {
  cart.push(id);
  updateCart();
}

async function updateCart() {
  document.getElementById("count").textContent = cart.length;

  try {
    const response = await fetch(`${API}/products`);
    const products = await response.json();

    const items = cart.map(id => products.find(p => p.id === id))
      .filter(Boolean);

    document.getElementById("cart-items").innerHTML =
      items.map(p => `<p>${escapeHTML(p.name)} - ₹${p.price}</p>`).join("");

    const total = items.reduce((sum, p) => sum + Number(p.price), 0);
    document.getElementById("total").textContent = total.toFixed(2);
  } catch (error) {
    document.getElementById("message").textContent =
      "Unable to update cart.";
  }
}

async function checkout() {
  if (!cart.length) {
    document.getElementById("message").textContent =
      "Your cart is empty.";
    return;
  }

  try {
    const response = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map(id => ({ productId: id, quantity: 1 }))
      })
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.error);

    document.getElementById("message").textContent =
      `Order placed successfully! Order ID: ${result.orderId}`;

    cart = [];
    updateCart();
  } catch (error) {
    document.getElementById("message").textContent =
      error.message || "Order failed.";
  }
}

loadProducts();

