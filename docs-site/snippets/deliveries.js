import { createMorph } from "morphcard";

const list = document.querySelector(".list");
const sheet = document.querySelector(".sheet");

const morph = createMorph({
  sheet,
  background: list,
  scrim: document.querySelector(".scrim"),
  // Runs before anything is measured: fill the sheet for this card.
  prepare(card) {
    const item = items.find((d) => d.id === card?.dataset.id);
    sheet.querySelector('[data-morph="route"]').textContent = item.route;
    sheet.querySelector('[data-morph="company"]').textContent = item.company;
    sheet.querySelector('[data-morph="status"]').textContent = item.status;
  },
});

list.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (card) morph.open(card);
});

// Back, the scrim and Escape close it: any [data-morph-close] works.
