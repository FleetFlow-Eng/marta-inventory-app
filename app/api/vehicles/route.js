// app/api/vehicles/route.js
// This file is ONLY for the live bus positions
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.MARTA_API_KEY;
    const URL = `https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb?apiKey=${apiKey}`;

    const response = await fetch(URL, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`MARTA Error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    return NextResponse.json(feed);

  } catch (error) {
    console.error("Vehicle API Error:", error);
    return NextResponse.json({ error: "Failed to fetch buses" }, { status: 500 });
  }
}