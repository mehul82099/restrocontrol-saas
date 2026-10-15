// Isolated browser fixtures only. No real API requests or database writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const output = process.env.OUTPUT_DIR || '/tmp/restrocontrol-preview'; fs.mkdirSync(output,{recursive:true});
(async()=>{
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
let calls=[], failCheckout=true, failKds=false;
const user={id:'fixture-user',restaurantId:'fixture-r',name:'Preview Owner',role:'OWNER',restaurantName:'Preview Cafe',email:'preview@example.invalid',activeOutletId:'fixture-o',outlets:[{id:'fixture-o',name:'Preview outlet',isDefault:true}]};
const catalog={restaurant:{name:'Preview Cafe',taxNumber:'TEST-TAX-ID',address:'Fixture address, not a real restaurant',phone:'0000000000'},categories:[{id:'coffee',name:'Coffee'}],items:Array.from({length:105},(_,i)=>({id:`dish-${i}`,name:i===0?'Cappuccino':`Cafe dish ${i}`,basePrice:100,taxRate:i===1?12:5,isVeg:true,categoryId:'coffee',category:{name:'Coffee'},variants:[],addons:[]})),tables:[{id:'table-1',tableNumber:'T1',status:'AVAILABLE'}],customers:[]};
await page.route('**/api/**',async route=>{
const u=new URL(route.request().url()); let data;
if(u.pathname==='/api/auth/me')data={success:true,user};
else if(u.pathname==='/api/pos/catalog')data={success:true,catalog};
else if(u.pathname==='/api/pos/checkout'){
 const payload=route.request().postDataJSON();calls.push(payload);
 if(failCheckout) return route.abort('failed');
 data={success:true,receiptRestaurant:catalog.restaurant,order:{id:'order-1',orderNumber:'FIXTURE-ORDER',createdAt:new Date().toISOString(),subtotal:payload.subtotal,taxAmount:payload.taxAmount,deliveryFee:payload.deliveryFee,totalAmount:payload.totalAmount},items:payload.items.map((i,n)=>({...i,id:`i${n}`})),consumption:[]};
}else if(u.pathname==='/api/kot'){
 if(failKds)return route.fulfill({status:503,json:{success:false,error:'Fixture connection error'}});
 data={success:true,tickets:[{id:'ticket',kotNumber:'KOT-20261001-abcdef123456',createdAt:'2026-10-01T00:00:00Z',status:'NEW',items:[{id:'ki',quantity:2,orderItem:{name:'Cappuccino'},notes:'No sugar'}],order:{orderNumber:'ORD-abcdef123456',orderType:'DINE_IN',table:{tableNumber:'T1'}}}]};
}else if(u.pathname==='/api/analytics/dashboard')data={success:true,summary:{totalSales:0,ordersCount:0,averageOrderValue:0,overallFoodCostPercent:null,overallGrossContribution:0,totalWastageCost:0,lowStockCount:0},varianceSummary:{totalTracked:0,highVarianceCount:0},lowStockItems:[],topSellingItems:[],lowMarginItems:[],recentPurchases:[]};
else data={success:true};
return route.fulfill({json:data});
});
await page.goto('http://127.0.0.1:3000/pos?tableId=table-1');
await page.getByText('Table T1 selected.').waitFor();
await page.getByRole('heading',{name:'Cappuccino',exact:true}).click();

await page.screenshot({path:output+'/restro-pos-desktop.png',fullPage:true});
const hold=page.getByRole('button',{name:/Hold Order/});
await hold.click();
await page.reload();
await page.getByRole('button',{name:'Held (1)'}).click();
await page.getByRole('button',{name:/Resume/}).click();
await page.getByRole('button',{name:/Proceed|Charge|Pay /}).last().click();
await page.getByRole('button',{name:'Confirm Payment & Deduct Inventory'}).click();
await page.getByRole('button',{name:'Retry same checkout'}).waitFor();
await page.reload();
await page.getByRole('button',{name:'Retry same checkout'}).waitFor();
failCheckout=false;
await page.getByRole('button',{name:'Retry same checkout'}).click();
await page.getByText('TEST-TAX-ID',{exact:false}).waitFor();
assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
assert.equal(calls[0].tableId,'table-1');
assert.equal(calls[0].payments[0].transactionRef,undefined);
await page.screenshot({path:output+'/restro-receipt.png',fullPage:true});
await page.goto('http://127.0.0.1:3000/kot');
await page.getByText('#EF123456',{exact:true}).waitFor();
await page.screenshot({path:output+'/restro-kds-desktop.png',fullPage:true});
failKds=true;
await page.getByTitle('Refresh now').click();
await page.getByRole('alert').filter({hasText:'Fixture connection error'}).waitFor();
assert.ok(await page.getByText('Cappuccino',{exact:false}).count());
await page.goto('http://127.0.0.1:3000/');await page.getByText('No sales in this period').waitFor();
await page.screenshot({path:output+'/restro-dashboard-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
await page.goto('http://127.0.0.1:3000/pos');await page.getByRole('heading',{name:'Cappuccino',exact:true}).waitFor();
await page.screenshot({path:output+'/restro-pos-mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
await page.getByRole('heading',{name:'Cappuccino',exact:true}).click();
await page.getByRole('button',{name:/Proceed|Charge|Pay /}).last().scrollIntoViewIfNeeded();
await page.screenshot({path:output+'/restro-pos-mobile-cart.png'});
// Failure is distinct from an empty menu; corrupt recovery fails closed.
await page.evaluate(()=>localStorage.setItem('restrocontrol:pos:v1:fixture-r:fixture-user:fixture-o','broken-json'));
await page.reload();
await page.getByText(/Unexpected token|Saved order is unreadable/).waitFor();
assert.ok(await page.locator('fieldset:disabled').count());
await browser.close();
console.log('PASS isolated UI: 105-item menu, table handoff, hold/reload/resume, lost-response/reload/exact retry, real receipt identity, no fake UPI reference, KDS stale error, zero-sales dashboard, mobile overflow');
})().catch(e=>{console.error(e);process.exit(1)});
