require('dotenv').config();
const express=require('express'),fs=require('fs'),crypto=require('crypto'),nodemailer=require('nodemailer');
const app=express();app.use(express.json());app.use(express.static('public'));
const F='data.json';
// [name, category, sub, price, salePrice, rating, popularity, stock, emoji]
const S=[['Rosewood Matte Lipstick','Makeup','Lipsticks',1800,0,4.8,95,40,'💄'],['Cherry Red Lipstick','Makeup','Lipsticks',1900,1500,4.7,90,30,'💋'],['Glass Shine Lip Gloss','Makeup','Lip Gloss',1200,0,4.5,70,50,'✨'],['Silk Skin Foundation','Makeup','Foundation',3200,2700,4.6,80,25,'🧴'],['Peach Glow Blush','Makeup','Blush',1600,0,4.7,85,35,'🌸'],['Sunset Eyeshadow Palette','Makeup','Eyeshadow Palettes',3800,3200,4.9,98,20,'🎨'],['Volume Boost Mascara','Makeup','Mascara',1500,0,4.4,75,45,'👁️'],['Precision Liquid Eyeliner','Makeup','Eyeliners',1100,0,4.3,60,60,'🖊️'],['Pro Makeup Brush Set','Makeup','Makeup Brushes',2900,2400,4.8,88,15,'🖌️'],['Gold Hoop Earrings','Accessories','Earrings',1400,0,4.6,82,40,'⭕'],['Pearl Drop Earrings','Accessories','Earrings',1700,1300,4.8,92,30,'🦪'],['Layered Gold Necklace','Accessories','Necklaces',2600,0,4.7,86,22,'📿'],['Charm Bracelet','Accessories','Bracelets',1900,0,4.5,66,28,'🔗'],['Crystal Stone Ring','Accessories','Rings',1300,1000,4.4,58,50,'💍'],['Pearl Hair Clips (Set of 4)','Accessories','Hair Clips',800,0,4.6,77,70,'🎀'],['Blush Mini Handbag','Accessories','Handbags',5500,4600,4.9,97,12,'👜'],['Cat-Eye Sunglasses','Accessories','Sunglasses',2300,0,4.5,72,26,'🕶️'],['Rose Gold Watch','Accessories','Watches',6500,5500,4.8,89,10,'⌚'],['Heart Pendant Necklace','Accessories','Necklaces',1500,0,4.6,68,34,'💗'],['Butterfly Hair Claw','Accessories','Hair Clips',700,0,4.3,55,80,'🦋']];
const init=()=>({products:S.map((s,i)=>({id:i+1,name:s[0],cat:s[1],sub:s[2],price:s[3],sale:s[4],rating:s[5],pop:s[6],stock:s[7],emoji:s[8],desc:`${s[0]} from Glamora's ${s[1].toLowerCase()} collection. Made to make your everyday moments special.`,specs:`Category: ${s[2]} | Brand: Glamora | Delivery: 3-5 working days`})),orders:[],messages:[],nid:21});
let db=fs.existsSync(F)?JSON.parse(fs.readFileSync(F)):init();
const save=()=>fs.writeFileSync(F,JSON.stringify(db,null,1));save();
const tokens=new Set(),auth=(q,s,n)=>tokens.has(q.headers['x-token'])?n():s.status(401).json({error:'Admin login required'});
const pr=p=>p.sale||p.price,esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mail=process.env.SMTP_USER&&process.env.SMTP_PASS?nodemailer.createTransport({host:process.env.SMTP_HOST,port:+process.env.SMTP_PORT||465,secure:(+process.env.SMTP_PORT||465)==465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}):null;
async function sendMail(o){
  if(!mail)return 'Email not configured (add SMTP details to .env)';
  const rows=o.items.map(i=>`<tr><td style="padding:8px;border-bottom:1px solid #fce4ec">${esc(i.name)} × ${i.qty}</td><td align="right" style="padding:8px;border-bottom:1px solid #fce4ec">PKR ${(i.price*i.qty).toLocaleString()}</td></tr>`).join('');
  const html=`<div style="font-family:Arial,sans-serif;background:#FFF9F4;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden"><div style="background:linear-gradient(135deg,#E7A1B0,#B76E79);color:#fff;padding:28px;text-align:center"><h1 style="margin:0;font-family:Georgia,serif">Glamora</h1><p style="margin:4px 0 0">Beauty &amp; Style, Your Way</p></div><div style="padding:24px;color:#4A3636"><h2>Thank you for shopping with Glamora, ${esc(o.customer.name)}!</h2><p>Your order has been successfully placed.</p><p style="font-size:18px"><b>Order Number: ${o.orderNo}</b></p><table width="100%" style="border-collapse:collapse">${rows}<tr><td style="padding:8px">Delivery</td><td align="right">PKR ${o.delivery}</td></tr><tr><td style="padding:8px"><b>Total</b></td><td align="right"><b>PKR ${o.total.toLocaleString()}</b></td></tr></table><p><b>Delivery address:</b><br>${esc(o.customer.address)}, ${esc(o.customer.city)} ${esc(o.customer.postal)}</p><p><b>Estimated delivery:</b> 3–5 working days</p><p>We are excited to deliver your beauty and fashion favorites.<br>Thank you for choosing Glamora! 💖</p></div></div></div>`;
  try{await mail.sendMail({from:`"Glamora" <${process.env.SMTP_USER}>`,to:o.customer.email,subject:'Your Glamora Order Has Been Confirmed!',html});return 'sent'}catch(e){console.error('Email error:',e.message);return 'Email failed: '+e.message}
}
app.get('/api/products',(q,s)=>s.json(db.products));
app.post('/api/orders',async(q,s)=>{
  const{customer:c,items,payment}=q.body||{};
  if(!c||!['name','email','phone','address','city','postal'].every(k=>c[k]&&String(c[k]).trim()))return s.status(400).json({error:'Please fill in all customer details'});
  if(!/^\S+@\S+\.\S+$/.test(c.email))return s.status(400).json({error:'Invalid email address'});
  if(!Array.isArray(items)||!items.length)return s.status(400).json({error:'Cart is empty'});
  const lines=[];
  for(const i of items){const p=db.products.find(x=>x.id==i.id),n=parseInt(i.qty);
    if(!p||!(n>0))return s.status(400).json({error:'Invalid item'});
    if(n>p.stock)return s.status(400).json({error:`Only ${p.stock} of "${p.name}" left in stock`});
    lines.push({p,n})}
  lines.forEach(({p,n})=>p.stock-=n);
  const sub=lines.reduce((t,{p,n})=>t+pr(p)*n,0),delivery=sub>=5000?0:250;
  let orderNo;do orderNo='GLM-'+crypto.randomInt(100000,999999);while(db.orders.some(o=>o.orderNo==orderNo));
  const o={orderNo,customer:Object.fromEntries(Object.keys(c).map(k=>[k,String(c[k]).trim()])),items:lines.map(({p,n})=>({id:p.id,name:p.name,price:pr(p),qty:n,emoji:p.emoji})),subtotal:sub,delivery,total:sub+delivery,payment:payment=='online'?'Demo Online Payment':'Cash on Delivery',status:'Order Placed',date:new Date().toISOString()};
  db.orders.unshift(o);save();
  o.emailStatus=await sendMail(o);s.json(o);
});
app.get('/api/track',(q,s)=>{const o=db.orders.find(x=>x.orderNo==String(q.query.no||'').trim().toUpperCase()&&x.customer.email.toLowerCase()==String(q.query.email||'').trim().toLowerCase());o?s.json(o):s.status(404).json({error:'No order found with that number and email'})});
app.post('/api/contact',(q,s)=>{db.messages.push({...q.body,date:new Date().toISOString()});save();s.json({ok:true})});
app.post('/api/chat',async(q,s)=>{
  if(!process.env.ANTHROPIC_API_KEY)return s.status(501).json({error:'no key'});
  try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-haiku-5-5',max_tokens:300,system:'You are Glamora Beauty Assistant, a friendly shopping helper for Glamora, a beauty & fashion store (prices in PKR). Be brief, warm, and recommend ONLY from this catalog: '+db.products.map(p=>`${p.name} (${p.sub}, PKR ${pr(p)})`).join('; ')+'. Delivery is PKR 250 (free over PKR 5000); payment by Cash on Delivery or demo online payment; delivery takes 3-5 days.',messages:(q.body.messages||[]).slice(-10)})});
    const d=await r.json();s.json({reply:d.content.map(c=>c.text||'').join('')})}catch(e){s.status(500).json({error:'chat failed'})}
});
app.post('/api/admin/login',(q,s)=>{if(q.body.password&&q.body.password===(process.env.ADMIN_PASSWORD||'admin123')){const t=crypto.randomBytes(24).toString('hex');tokens.add(t);s.json({token:t})}else s.status(401).json({error:'Wrong password'})});
app.get('/api/admin/orders',auth,(q,s)=>s.json(db.orders));
app.put('/api/admin/orders/:no',auth,(q,s)=>{const o=db.orders.find(x=>x.orderNo==q.params.no);if(!o||!['Order Placed','Processing','Shipped','Delivered'].includes(q.body.status))return s.status(400).json({error:'Bad request'});o.status=q.body.status;save();s.json(o)});
const clean=b=>({name:String(b.name||'').trim(),cat:b.cat=='Makeup'?'Makeup':'Accessories',sub:String(b.sub||'').trim(),price:Math.max(0,+b.price||0),sale:Math.max(0,+b.sale||0),stock:Math.max(0,parseInt(b.stock)||0),emoji:b.emoji||'🎁',img:String(b.img||'').trim(),desc:String(b.desc||''),specs:String(b.specs||'')});
app.post('/api/admin/products',auth,(q,s)=>{const c=clean(q.body);if(!c.name||!c.price)return s.status(400).json({error:'Name and price required'});const p={id:db.nid++,rating:4.5,pop:50,...c};db.products.push(p);save();s.json(p)});
app.put('/api/admin/products/:id',auth,(q,s)=>{const p=db.products.find(x=>x.id==q.params.id);if(!p)return s.status(404).json({error:'Not found'});Object.assign(p,clean({...p,...q.body}));save();s.json(p)});
app.delete('/api/admin/products/:id',auth,(q,s)=>{db.products=db.products.filter(x=>x.id!=q.params.id);save();s.json({ok:true})});
app.listen(process.env.PORT||3000,()=>console.log('Glamora running at http://localhost:'+(process.env.PORT||3000)));
