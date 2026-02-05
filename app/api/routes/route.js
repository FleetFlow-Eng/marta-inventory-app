export async function GET() {
  try {
    const res = await fetch("https://gtfs-static.itsmarta.com/google_transit.zip"); // Replace with your specific JSON feed if using one
    const data = await res.json();
    // MARTA's static feed needs to be flattened so the Map can search it easily
    const routes = data.routes || data; 
    return Response.json(routes);
  } catch (error) {
    return Response.json({ error: "Failed to fetch routes" }, { status: 500 });
  }
}