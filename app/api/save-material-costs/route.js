import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { csv } = await req.json();

    const filePath = path.join(process.cwd(), "public", "data", "material_costs.csv");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, csv, "utf8");

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// 405の切り分け用：GETでも生存確認できるようにする
export async function GET() {
  return Response.json({ ok: true, msg: "save-csv route alive" }, { status: 200 });
}