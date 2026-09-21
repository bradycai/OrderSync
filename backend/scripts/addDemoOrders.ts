import { EXTRA_ORDERS, EXTRA_LISTING_MAPS } from "../../shared/src/extraSeed";
import { activeAlerts, autoResolveReason, DEMO_NOW, detectAlerts } from "@orderwatch/shared";
import { db } from "../src/db";

try {
  const added = db.write(tables => {
    let count = 0;
    for (const order of EXTRA_ORDERS) {
      if (!tables.orders.some(o => o.key === order.key)) { tables.orders.push(structuredClone(order)); count++; }
    }
    for (const mapping of EXTRA_LISTING_MAPS) {
      if (!tables.listingMaps.some(m => m.channel === mapping.channel && m.listingTitle.trim().toLowerCase() === mapping.listingTitle.trim().toLowerCase())) tables.listingMaps.push(structuredClone(mapping));
    }
    return count;
  });
  const alerts = activeAlerts(detectAlerts(db.products, db.orders, DEMO_NOW), db.orders, db.actions);
  console.log(JSON.stringify({ added, totalOrders: db.orders.length, activeAlerts: alerts.length, critical: alerts.filter(a => a.severity === "critical").length, aiEligible: alerts.filter(a => !autoResolveReason(a, alerts, db.orders, db.actions)).length }));
} finally { db.close(); }
