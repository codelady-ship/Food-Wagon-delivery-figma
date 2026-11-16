// Food Wagon – landing page interactions (vanilla JS, no dependencies)

const DISHES = [
  { name: 'Veggie Pizza', restaurant: 'Golden Fork Bistro', price: 12.5, cat: 'italian', img: 'pizza', alt: 'Sliced pizza with tomatoes, onions and basil on a wooden board' },
  { name: 'Classic Cheeseburger', restaurant: 'Market Hall Grill', price: 9.9, cat: 'burger', img: 'burger', alt: 'Tall cheeseburger with lettuce and tomato' },
  { name: 'Shrimp Ramen', restaurant: 'Urban Loft Kitchen', price: 11.0, cat: 'asian', img: 'ramen', alt: 'Bowl of ramen with shrimp, boiled eggs and chopsticks' },
  { name: 'Salmon Sushi Set', restaurant: 'Sea Breeze Terrace', price: 15.0, cat: 'asian', img: 'sushi', alt: 'Salmon sushi rolls on a dark plate' },
  { name: 'Penne Arrabbiata', restaurant: 'Golden Fork Bistro', price: 10.5, cat: 'italian', img: 'pasta', alt: 'Penne pasta in tomato sauce on a white plate' },
  { name: 'Crispy Fried Chicken', restaurant: 'Market Hall Grill', price: 8.9, cat: 'chicken', img: 'chicken', alt: 'Golden fried chicken pieces on a cooling rack' },
  { name: 'Grilled Chicken Skewers', restaurant: 'Urban Loft Kitchen', price: 13.5, cat: 'chicken', img: 'skewers', alt: 'Grilled chicken and vegetable skewers with sauces' },
  { name: 'Rainbow Salad Bowl', restaurant: 'Sea Breeze Terrace', price: 9.5, cat: 'healthy', img: 'salad', alt: 'Salad bowl with tofu, egg, corn and red cabbage' },
  { name: 'Meatballs & Greens', restaurant: 'Market Hall Grill', price: 11.5, cat: 'healthy', img: 'meatballs', alt: 'Meatballs served on fresh lettuce leaves' },
  { name: 'Maple Pancakes', restaurant: 'Urban Loft Kitchen', price: 7.5, cat: 'dessert', img: 'pancakes', alt: 'Stack of pancakes with syrup and butter' },
  { name: 'Chocolate Brownie', restaurant: 'Golden Fork Bistro', price: 5.5, cat: 'dessert', img: 'brownie', alt: 'Stacked chocolate brownie squares' },
  { name: 'Fresh Orange Juice', restaurant: 'Sea Breeze Terrace', price: 3.9, cat: 'drinks', img: 'juice', alt: 'Glass of fresh orange juice with a lemon slice' },
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const grid = $('#items-grid');
const emptyMsg = $('#empty-msg');
const searchInput = $('#dish-search');
const chips = $$('.chip');
const cartCount = $('.cart-count');
const toastEl = $('#toast');

let activeCat = 'all';
let cart = 0;
let toastTimer;

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function renderItems() {
  const q = searchInput.value.trim().toLowerCase();
  const list = DISHES.filter(d =>
    (activeCat === 'all' || d.cat === activeCat) &&
    (!q || d.name.toLowerCase().includes(q) || d.restaurant.toLowerCase().includes(q))
  );

  grid.innerHTML = '';
  list.forEach(d => {
    const li = document.createElement('li');
    li.className = 'item-card';
    li.innerHTML = `
      <img src="images/${d.img}.webp" width="600" height="450" alt="" loading="lazy">
      <div class="item-body">
        <h3></h3>
        <p class="item-rest"></p>
        <p class="item-price">$${d.price.toFixed(2)}</p>
        <button type="button" class="btn btn-primary btn-block">Order now</button>
      </div>`;
    $('img', li).alt = d.alt;
    $('h3', li).textContent = d.name;
    $('.item-rest', li).textContent = d.restaurant;
    $('button', li).addEventListener('click', () => {
      cart += 1;
      cartCount.textContent = cart;
      toast(`${d.name} added to your order (demo)`);
    });
    grid.appendChild(li);
  });
  emptyMsg.hidden = list.length > 0;
}

function setCategory(cat) {
  activeCat = cat;
  chips.forEach(c => {
    const on = c.dataset.cat === cat;
    c.classList.toggle('active', on);
    c.setAttribute('aria-pressed', String(on));
  });
  renderItems();
}

chips.forEach(c => c.addEventListener('click', () => setCategory(c.dataset.cat)));
searchInput.addEventListener('input', renderItems);
$$('[data-jump-cat]').forEach(a => a.addEventListener('click', () => setCategory(a.dataset.jumpCat)));

// Delivery / pickup tabs
let mode = 'delivery';
$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  mode = tab.dataset.mode;
  $$('.tab').forEach(t => {
    const on = t === tab;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  $('#address').placeholder = mode === 'delivery' ? 'Enter your address' : 'Enter your area to find pickup points';
}));

// Address search
$('#address-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#address');
  const msg = $('#address-msg');
  const value = input.value.trim();
  if (value.length < 3) {
    msg.textContent = 'Please enter an address (at least 3 characters).';
    msg.className = 'form-msg error';
    input.focus();
    return;
  }
  msg.textContent = `Showing ${mode} options near “${value}” (demo).`;
  msg.className = 'form-msg ok';
  $('#popular').scrollIntoView({ behavior: 'smooth' });
});

// Store buttons (no real app yet)
$$('.store-btn').forEach(b => b.addEventListener('click', () => toast(`The ${b.dataset.store} app is a demo – coming soon.`)));

// Mobile menu
const navToggle = $('.nav-toggle');
const nav = $('#site-nav');
function closeNav() {
  nav.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-label', 'Open menu');
}
navToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
$$('a', nav).forEach(a => a.addEventListener('click', closeNav));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

renderItems();
