import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

const BASE = "https://xn--10-yg4a1a3kyh.jp";

async function getArmorCategories() {
  const html = await axios.get(`${BASE}/dq10_item.html`);
  const $ = cheerio.load(html.data);

  const links = [];

  $("a").each((i, e) => {
    const href = $(e).attr("href");

    if (!href) return;

    if (href.includes("a_bogu")) {
      links.push(BASE + "/" + href);
    }
  });

  return [...new Set(links)];
}

async function getItems(url) {
  const html = await axios.get(url);
  const $ = cheerio.load(html.data);

  const links = [];

  $("a").each((i, e) => {
    const href = $(e).attr("href");

    if (!href) return;

    if (href.includes("dq10_bogu_k")) {
      links.push(BASE + "/" + href);
    }
  });

  return [...new Set(links)];
}

async function scrapeItem(url) {

  const html = await axios.get(url);
  const $ = cheerio.load(html.data);

  const name = $("h1").first().text().trim();

  let equipLevel = 0;

  $("td").each((i,e)=>{
    const t=$(e).text();
    if(t.includes("装備Lv")){
      equipLevel=parseInt(t.replace(/[^0-9]/g,""));
    }
  });

  const values = [];

  $("td").each((i, e) => {

    const t = $(e).text().trim();

    if (/^\d+$/.test(t))
      values.push(Number(t));

  });

  return { name, equipLevel, values };

}

async function main() {

  const cats = await getArmorCategories();

  const results = [];

  for (const cat of cats) {

    const items = await getItems(cat);

    for (const url of items) {

      const item = await scrapeItem(url);

      if (item.equipLevel >= 100) {
        results.push(item);
        console.log("OK", item.name);
      }

    }

  }

  fs.writeFileSync(
    "bogu_base_values_lv100plus.json",
    JSON.stringify(results, null, 2)
  );

}

main();