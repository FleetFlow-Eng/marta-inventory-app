{vehicles?.map((entity) => {
  const vehicle = entity?.vehicle;
  
  // 1. GET THE PROPER BUS NUMBER (Label is usually the fleet number)
  const unitNumber = vehicle?.vehicle?.label || vehicle?.vehicle?.id; 

  // 2. MATCH THE ROUTE ID TO GET THE PROPER ROUTE NUMBER
  const currentRouteId = vehicle?.trip?.route_id;
  const routeMatch = routes?.find(r => 
    String(r.route_id) === String(currentRouteId)
  );

  // Use route_short_name (e.g., "191") instead of the internal ID
  const routeDisplay = routeMatch?.route_short_name || "??";

  if (!vehicle?.position) return null;

  return (
    <Marker 
      key={entity.id} 
      position={[vehicle.position.latitude, vehicle.position.longitude]}
      icon={busIcon}
    >
      <Tooltip direction="top" offset={[0, -40]}>
        <div className="font-black text-[#002d72] px-1">
          BUS #{unitNumber} | RT {routeDisplay}
        </div>
      </Tooltip>
      
      <Popup>
        <div className="p-1">
          <p className="font-black text-[#002d72] uppercase italic">Unit #{unitNumber}</p>
          <p className="text-[10px] font-bold text-[#ef7c00]">
            {routeMatch?.route_long_name || "Route Info Unavailable"}
          </p>
        </div>
      </Popup>
    </Marker>
  );
})}