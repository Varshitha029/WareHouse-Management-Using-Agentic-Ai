const http = require('http');
function req(url, method='GET', headers={}, body=null, timeoutMs=45000){
  return new Promise((resolve,reject)=>{
    const u = new URL(url);
    const req = http.request({hostname:u.hostname, port:u.port, path:u.pathname+u.search, method, headers:{'Content-Type':'application/json', ...headers}, timeout: timeoutMs}, (res)=>{
      let d=''; res.on('data', c=>d+=c); res.on('end', ()=>{
        let parsed = d;
        try { parsed = JSON.parse(d); } catch {}
        resolve({status:res.statusCode, data:parsed, headers:res.headers});
      });
    });
    req.on('timeout', ()=>{ req.destroy(new Error('timeout')); });
    req.on('error', reject);
    if(body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}
(async()=>{
  const login = await req('http://localhost:5000/api/auth/login','POST',{}, {login:'gangadharreddy0424@gmail.com', password:'Ganga@0424'}, 20000);
  if(login.status !== 200 || !login.data?.token){ console.log('LOGIN_FAIL|' + login.status); return; }
  const jwt = login.data.token;
  const authH = { Authorization: `Bearer ${jwt}` };

  const backendTests = [
    ['chat','POST','http://localhost:5000/api/ai/chat',{message:'ping', context:{}}],
    ['full_analysis','POST','http://localhost:5000/api/ai/full-analysis',{role:'owner'}],
    ['inventory_analyze','POST','http://localhost:5000/api/ai/inventory/analyze',{action:'analyze'}],
    ['weighbridge_analyze','POST','http://localhost:5000/api/ai/weighbridge/analyze',{vehicle_number:'T',gross_weight:50,tare_weight:40,net_weight:10}],
    ['loan_risk_assess','POST','http://localhost:5000/api/ai/loan-risk/assess',{action:'assess',loanAmount:100000,grainType:'wheat',grainQuantity:100}],
    ['risk_assessment','POST','http://localhost:5000/api/ai/risk-assessment',{action:'portfolio'}],
    ['market_predict','POST','http://localhost:5000/api/ai/market/predict',{action:'predict',grainType:'wheat',horizon:'1month',marketState:'Karnataka'}],
    ['demand_predict','POST','http://localhost:5000/api/ai/demand/predict',{action:'predict',grainType:'rice',quantity:100}],
    ['anomaly_detect','POST','http://localhost:5000/api/ai/anomaly/detect',{action:'detect',entityType:'vehicle',entityId:'X'}],
    ['anomaly_alerts','GET','http://localhost:5000/api/ai/anomaly/alerts',null],
    ['predict_duration','POST','http://localhost:5000/api/ai/predict-duration',{grain_type:'rice',total_bags:100,total_weight_kg:5000,monthly_rent_per_bag:50}],
  ];

  console.log('=== BACKEND ROUTES ===');
  for (const [name,m,u,b] of backendTests){
    try{
      const r = await req(u,m,authH,b,45000);
      const ok = r.status >= 200 && r.status < 300;
      const src = r.data?.source || (r.data?.workflow ? 'n8n-workflow' : (r.data?.agent ? 'direct-agent' : 'unknown'));
      console.log(`${ok?'PASS':'FAIL'}|${name}|status=${r.status}|source=${src}`);
    }catch(e){
      console.log(`FAIL|${name}|msg=${e.message}`);
    }
  }

  const hooks = ['wms-inventory-analyze','wms-market-predict-v2','wms-anomaly-detect','wms-predict-duration','wms-loan-risk-assess','wms-weighbridge-analyze','wms-chat','wms-demand-predict','wms-anomaly-alerts','wms-full-analysis','wms-market-analysis','wms-storage-optimization','wms-risk-assessment'];
  const payload = { body:{ action:'test', grainType:'wheat', horizon:'1month', grain_type:'rice', total_bags:50, total_weight_kg:2500, monthly_rent_per_bag:50 }, query:{}, originalEndpoint:'/test' };

  console.log('=== DIRECT WEBHOOKS (13) ===');
  for (const p of hooks){
    try{
      const r = await req(`http://localhost:5678/webhook/${p}`,'POST',{},payload,45000);
      const ok = r.status >= 200 && r.status < 300;
      console.log(`${ok?'PASS':'FAIL'}|${p}|status=${r.status}`);
    }catch(e){
      console.log(`FAIL|${p}|msg=${e.message}`);
    }
  }
})();
