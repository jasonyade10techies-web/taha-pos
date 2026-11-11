import { demoDb, newId } from "./database";
import { posProducts } from "../../mocks/products";
import { permissionKeys } from "../../types/auth";
import type {
  DemoProduct,
  DemoSettings,
  Location,
  Sale,
  DemoEmployee,
} from "../../types/demo";

export const defaultSettings: DemoSettings = {
  id: "main",
  storeName: "Taha Mobiles",
  branch: "Main Branch",
  currency: "PKR",
  timezone: "Asia/Karachi",
  receiptPrinting: "Ask After Checkout",
  customerDisplay: true,
  requireProof: false,
  bargaining: true,
  belowMinimum: "Manager Approval",
  lowStockAlerts: true,
  negativeStock: false,
  defaultUnit: "Piece",
  receiptRequired: true,
  returnDays: 30,
  returnApproval: false,
  restoreReturns: true,
  notifications: true,
  receiptFooter: "Thank you for choosing Taha Mobiles.",
  creditEnabled: true,
};
const stamp = (days = 0, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
export async function seedDemo(reset = false) {
  await demoDb.transaction("rw", demoDb.tables, async () => {
    if (!reset && (await demoDb.meta.get("seed"))) return;
    for (const table of demoDb.tables) await table.clear();
    const locations: Location[] = [];
    let l = 0;
    for (const rack of ["01", "02", "03", "04", "06", "08", "12"]) {
      const rackId = `rack-${rack}`;
      locations.push({
        id: rackId,
        code: `TM-L-${String(++l).padStart(6, "0")}`,
        name: `Rack ${rack}`,
        kind: "rack",
        parentId: "",
        archived: false,
      });
      for (const shelf of ["A", "B", "C"]) {
        const shelfId = `shelf-${rack}-${shelf}`;
        locations.push({
          id: shelfId,
          code: `TM-L-${String(++l).padStart(6, "0")}`,
          name: `Shelf ${shelf}`,
          kind: "shelf",
          parentId: rackId,
          archived: false,
        });
        for (const box of ["01", "02", "03", "04", "05", "06"])
          locations.push({
            id: `box-${rack}-${shelf}-${box}`,
            code: `TM-L-${String(++l).padStart(6, "0")}`,
            name: `Box ${box}`,
            kind: "box",
            parentId: shelfId,
            archived: false,
          });
      }
    }
    await demoDb.locations.bulkAdd(locations);
    const employees: DemoEmployee[] = [
      {
        id: "owner-1",
        full_name: "Ahmed Khan",
        email: "ahmed@demo.invalid",
        phone: "0300 0000001",
        avatar_url: null,
        role: "owner",
        status: "active",
        permissions: [...permissionKeys],
        shift: "09:00 – 18:00",
        lastActivity: stamp(),
      },
      {
        id: "manager-1",
        full_name: "Ali Raza",
        email: "ali@demo.invalid",
        phone: "0300 0000002",
        avatar_url: null,
        role: "manager",
        status: "active",
        permissions: permissionKeys.filter(
          (k) =>
            ![
              "costs.view_purchase_cost",
              "profit.view",
              "employees.permissions",
              "settings.manage",
            ].includes(k),
        ),
        shift: "09:00 – 18:00",
        lastActivity: stamp(),
      },
      {
        id: "employee-1",
        full_name: "Hamza",
        email: "hamza@demo.invalid",
        phone: "0300 0000003",
        avatar_url: null,
        role: "employee",
        status: "active",
        permissions: [
          "sales.create",
          "sales.view",
          "pricing.discount_within_range",
          "credit.create",
          "credit.receive_payment",
          "inventory.view",
          "returns.create",
        ],
        shift: "09:00 – 16:00",
        lastActivity: stamp(),
      },
    ];
    await demoDb.employees.bulkAdd(employees);
    const products: DemoProduct[] = posProducts
      .filter((p) => p.category !== "Services")
      .map((p) => ({
        id: p.id,
        internalCode: `TM-P-${p.id.slice(1).padStart(6, "0")}`,
        name: p.name,
        category: p.category,
        brand: p.brand,
        compatibleModel: p.compatibleModel,
        qualityGrade: p.qualityGrade,
        color: p.color,
        sellingPrice: p.sellingPrice,
        minimumSellingPrice: p.minimumSellingPrice,
        aliases: p.aliases,
        lowStockLevel: p.lowStockLevel,
        state: "active",
        locationId: p.location
          ? `box-${p.location.rack}-${p.location.shelf}-${p.location.box}`
          : "box-01-A-01",
        variant: "",
        unit: "Piece",
        notes: "",
        image: "",
        createdAt: stamp(12),
      }));
    const templates = [
      ["Samsung A15 Battery", "Samsung", "Galaxy A15", 2300, 1900],
      ["Samsung A15 Screen", "Samsung", "Galaxy A15", 6200, 5500],
      ["iPhone 13 Original Screen", "Apple", "iPhone 13", 19500, 18000],
      ["iPhone 13 Back Glass", "Apple", "iPhone 13", 1800, 1500],
      ["iPhone 11 Battery", "Apple", "iPhone 11", 2800, 2400],
      ["Samsung A54 Back Cover", "Samsung", "Galaxy A54", 1700, 1400],
      ["Samsung S23 Camera", "Samsung", "Galaxy S23", 8500, 7500],
      ["Tempered Glass", "Generic", "Universal", 450, 300],
      ["Mobile Repair Toolkit", "Jakemy", "Repair tools", 3200, 2800],
      ["iPhone 13 OLED Screen", "Apple", "iPhone 13", 12500, 11000],
      ["Samsung A15 Charging Board", "Samsung", "Galaxy A15", 1450, 1300],
    ] as const;
    for (let i = 10; i <= 125; i++) {
      const t = templates[(i - 10) % templates.length];
      const grade = ["Original", "OEM", "AAA", "A+", "A", "B", "Copy", "OLED"][
        (i - 10) % 8
      ];
      const color = ["Black", "White", "Blue", "Gold"][(i - 10) % 4];
      products.push({
        id: `p${i}`,
        internalCode: `TM-P-${String(i).padStart(6, "0")}`,
        name: t[0],
        category: i % 11 === 6 || i % 11 === 7 ? "Accessories" : "Parts",
        brand: t[1],
        compatibleModel: t[2],
        qualityGrade: grade,
        color,
        sellingPrice: t[3],
        minimumSellingPrice: t[4],
        aliases: [
          t[2].toLowerCase(),
          ...(t[0].includes("Charging")
            ? ["charging patta", "charging patti", "charge board"]
            : []),
          ...(t[0].includes("Screen")
            ? ["screen", "sr", "panel", "display"]
            : []),
          ...(t[0].includes("Battery") ? ["battery", "betri"] : []),
        ],
        lowStockLevel: 5,
        state: i > 122 ? "archived" : "active",
        locationId: `box-${["01", "04", "08", "12"][i % 4]}-${["A", "B", "C"][i % 3]}-${String((i % 6) + 1).padStart(2, "0")}`,
        variant: "",
        unit: "Piece",
        notes: "Local demonstration stock.",
        image: "",
        createdAt: stamp(12),
      });
    }
    await demoDb.products.bulkAdd(products);
    const costs = Object.fromEntries(
      products.map((p) => [p.id, Math.round(p.sellingPrice * 0.64)]),
    );
    await demoDb.financials.bulkAdd(
      products.map((p) => ({ id: p.id, cost: costs[p.id] })),
    );
    const services = [
      "Screen Installation",
      "Screen Replacement",
      "Battery Replacement",
      "Charging Port Repair",
      "Speaker Repair",
      "Microphone Repair",
      "Camera Repair",
      "Back Glass Replacement",
      "Motherboard Repair",
      "Water Damage Service",
      "Software Installation",
    ];
    await demoDb.services.bulkAdd(
      services.map((name, i) => ({
        id: i === 0 ? "p8" : `svc-${i}`,
        code: `TM-S-${String(i + 1).padStart(6, "0")}`,
        name,
        category: i === 10 ? "Software" : "Repair",
        sellingPrice: i === 0 ? 800 : 800 + i * 350,
        minimumSellingPrice: i === 0 ? 500 : 600 + i * 250,
        active: true,
        notes: "Labour only; parts charged separately.",
      })),
    );
    await demoDb.paymentMethods.bulkAdd([
      {
        id: "cash",
        name: "Cash",
        kind: "Cash",
        title: "TAHA MOBILES",
        number: "",
        iban: "",
        qr: "",
        enabled: true,
      },
      {
        id: "jazzcash",
        name: "JazzCash",
        kind: "Digital",
        title: "TAHA MOBILES · Demo account",
        number: "0300 0000000",
        iban: "",
        qr: "",
        enabled: true,
      },
      {
        id: "easypaisa",
        name: "Easypaisa",
        kind: "Digital",
        title: "TAHA MOBILES · Demo account",
        number: "0310 0000000",
        iban: "",
        qr: "",
        enabled: true,
      },
      {
        id: "bank",
        name: "Bank Transfer",
        kind: "Digital",
        title: "TAHA MOBILES · Demo account",
        number: "Demo 00012345",
        iban: "PK00 DEMO 0000 0000 0000 0000",
        qr: "",
        enabled: true,
      },
      {
        id: "credit",
        name: "Credit",
        kind: "Credit",
        title: "Internal credit account",
        number: "",
        iban: "",
        qr: "",
        enabled: true,
      },
    ]);
    const names = [
      "ABC Mobiles",
      "Usman Electronics",
      "City Phone Centre",
      "Bilal Mobile Repair",
      "Hassan Telecom",
      "Faisal Accessories",
      "Saad Khan",
      "Ayesha Malik",
      "Imran Shah",
      "Danish Ali",
      "Zain Mobile Lab",
      "Al Noor Mobiles",
    ];
    await demoDb.customers.bulkAdd(
      names.map((name, i) => ({
        id: `c${i + 1}`,
        name,
        type: i < 6 || i > 9 ? "Shop / Business" : "Individual",
        shopName: i < 6 || i > 9 ? name : "",
        ownerName:
          i < 6
            ? ["Asif", "Usman", "Kamran", "Bilal", "Hassan", "Faisal"][i]
            : name,
        collectingPerson: "",
        phone: `0300 000${String(i + 101)}`,
        address: "Local market, Pakistan",
        notes: "Demo account; amounts are illustrative.",
        photo: "",
        creditLimit: null,
        createdAt: stamp(20),
      })),
    );
    const sales: Sale[] = [];
    for (let i = 1; i <= 36; i++) {
      const p = products[(i * 3) % products.length];
      const qty = (i % 3) + 1;
      const unit = p.sellingPrice - (i % 4 === 0 ? 100 : 0);
      const total = unit * qty;
      const method = i % 5 === 0 ? "credit" : i % 3 === 0 ? "jazzcash" : "cash";
      const customerId = i % 5 === 0 ? `c${(i % 12) + 1}` : "";
      const sid = `sale-seed-${i}`;
      const employee = employees[i % 3];
      const createdAt = stamp(i % 7, 10 + (i % 8));
      sales.push({
        id: sid,
        invoice: `TM-INV-${String(i).padStart(6, "0")}`,
        customerId,
        customerName: customerId ? names[i % 12] : "Walk-in Customer",
        employeeId: employee.id,
        employeeName: employee.full_name,
        createdAt,
        lines: [
          {
            productId: p.id,
            name: p.name,
            variant: `${p.qualityGrade} · ${p.color}`,
            quantity: qty,
            originalPrice: p.sellingPrice,
            unitPrice: unit,
            minimumPrice: p.minimumSellingPrice,
            discount: 0,
            total,
            locationId: p.locationId,
            service: false,
          },
        ],
        subtotal: total,
        discount: (p.sellingPrice - unit) * qty,
        total,
        coupon: "",
        status: method === "credit" ? "Credit" : "Paid",
        payments: [{ methodId: method, amount: total, reference: "Demo seed" }],
        returned: {},
      });
      await demoDb.saleCosts.add({
        id: sid,
        cost: costs[p.id] * qty,
        byProduct: { [p.id]: costs[p.id] * qty },
      });
      await demoDb.payments.add({
        id: newId(),
        code: `TM-PAY-${String(i).padStart(6, "0")}`,
        saleId: sid,
        customerId,
        methodId: method,
        amount: total,
        kind: "sale",
        reference: "Demo seed",
        notes: "Seeded transaction",
        employeeId: employee.id,
        createdAt,
      });
      if (customerId)
        await demoDb.ledger.add({
          id: newId(),
          customerId,
          reference: sales[i - 1].invoice,
          description: "Credit sale",
          debit: total,
          credit: 0,
          employeeId: employee.id,
          createdAt,
        });
      await demoDb.movements.add({
        id: newId(),
        productId: p.id,
        locationId: p.locationId,
        quantity: -qty,
        type: "SALE",
        reference: sales[i - 1].invoice,
        employeeId: employee.id,
        notes: "Demo historical sale",
        createdAt,
      });
    }
    await demoDb.sales.bulkAdd(sales);
    for (const p of products) {
      const historical = sales
        .flatMap((s) => s.lines)
        .filter((line) => line.productId === p.id)
        .reduce((sum, line) => sum + line.quantity, 0);
      const original = posProducts.find((x) => x.id === p.id);
      const qty =
        original?.quantity ??
        (Number(p.id.slice(1)) % 9 === 0
          ? 0
          : Number(p.id.slice(1)) % 7 === 0
            ? 2
            : 10 + (Number(p.id.slice(1)) % 32));
      await demoDb.balances.add({
        id: `${p.id}:${p.locationId}`,
        productId: p.id,
        locationId: p.locationId,
        quantity: qty,
      });
      await demoDb.movements.add({
        id: newId(),
        productId: p.id,
        locationId: p.locationId,
        quantity: qty + historical,
        type: "RECEIVE",
        reference: "Demo opening stock",
        employeeId: "owner-1",
        notes: "Demo opening inventory",
        createdAt: stamp(12),
      });
    }
    await demoDb.suppliers.bulkAdd(
      [
        "Hafeez Mobile Parts",
        "Metro Accessories",
        "Original Parts Centre",
        "City Wholesale",
      ].map((name, i) => ({
        id: `supplier-${i + 1}`,
        name,
        phone: `0300 00100${i + 1}`,
        whatsapp: `9230000100${i + 1}`,
        address: "Wholesale mobile market",
        notes: "Local demonstration supplier.",
      })),
    );
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    await demoDb.coupons.bulkAdd([
      {
        id: "coupon-1",
        code: "TAHA10",
        type: "Percentage",
        value: 10,
        start: stamp(30).slice(0, 10),
        end: end.toISOString().slice(0, 10),
        minimum: 1000,
        maxUses: 100,
        uses: 0,
        perCustomerLimit: 0,
        eligible: "All",
        targets: [],
        active: true,
      },
      {
        id: "coupon-2",
        code: "TAHA500",
        type: "Fixed",
        value: 500,
        start: stamp(30).slice(0, 10),
        end: end.toISOString().slice(0, 10),
        minimum: 1000,
        maxUses: 100,
        uses: 0,
        perCustomerLimit: 0,
        eligible: "All",
        targets: [],
        active: true,
      },
    ]);
    for (let i = 0; i < 7; i++)
      for (const employee of employees)
        await demoDb.shifts.add({
          id: `shift-${employee.id}-${i}`,
          employeeId: employee.id,
          date: stamp(-i).slice(0, 10),
          start: "09:00",
          end: employee.role === "employee" ? "16:00" : "18:00",
          status: i === 0 ? "Open" : "Scheduled",
          openingCash: 10000,
          countedCash: null,
          cashExpenses: 0,
          expectedCash: null,
          difference: null,
          notes: "",
        });
    await demoDb.jobs.bulkAdd(
      ["iPhone 13 Pro", "Samsung Galaxy A15", "iPhone 11"].map((device, i) => ({
        id: `job-${i + 1}`,
        code: `TM-REP-${String(i + 1).padStart(6, "0")}`,
        customerId: `c${i + 7}`,
        customerName: names[i + 6],
        phone: "0300 0000000",
        device,
        imei: "",
        problem: ["Camera shaking", "Not charging", "Battery draining"][i],
        damage: "Minor frame scratches",
        photos: [],
        estimate: [7500, 2000, 3500][i],
        advance: i === 0 ? 1000 : 0,
        technicianId: "employee-1",
        notes: "Awaiting inspection.",
        status: i === 0 ? "Diagnosing" : i === 1 ? "Waiting Part" : "Ready",
        createdAt: stamp(2),
      })),
    );
    await demoDb.enquiries.bulkAdd([
      {
        id: "enquiry-1",
        name: "Usman",
        phone: "03000000000",
        device: "iPhone 13 Pro",
        problem: "Camera shaking",
        images: 3,
        status: "New",
        quote: 0,
        notes: "Customer asks for an estimate before visiting.",
        createdAt: stamp(),
      },
      {
        id: "enquiry-2",
        name: "Bilal",
        phone: "03100000000",
        device: "Samsung Galaxy A54",
        problem: "Back cover damaged",
        images: 1,
        status: "Contacted",
        quote: 0,
        notes: "",
        createdAt: stamp(1),
      },
    ]);
    await demoDb.audit.bulkAdd(
      sales.slice(-12).map((s) => ({
        id: newId(),
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        action: "sale.completed",
        module: "Sales",
        description: `${s.employeeName} sold ${s.lines[0].name}`,
        reference: s.invoice,
        createdAt: s.createdAt,
      })),
    );
    await demoDb.settings.add(defaultSettings);
    await demoDb.meta.bulkAdd([
      { id: "seed", value: 1 },
      { id: "TM-P-", value: 125 },
      { id: "TM-L-", value: l },
      { id: "TM-INV-", value: 36 },
      { id: "TM-PAY-", value: 36 },
      { id: "TM-REP-", value: 3 },
    ]);
  });
}
