import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // This fetches the static route info (Short Name, Long Name, etc.)
    const res = await fetch("https://gtfs-static.itsmarta.com/google_transit.zip"); // or your specific MARTA static JSON endpoint
    const data = await res.json();
    
    // Ensure we are sending a clean array of route objects
    const routes = data.routes || data; 
    return Response.json(routes);
  } catch (error) {
    return Response.json({ error: "Failed to fetch routes" }, { status: 500 });
  }
}