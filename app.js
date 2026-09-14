const stocks={
  SPCX:{name:'SpaceX',price:100,dividend:0,frequency:'None',note:'Tokenized security · demo',traditional:false,tokenized:true,eligible:true},
  AAPL:{name:'Apple',price:200,dividend:1,frequency:'Quarterly',note:'Traditional + tokenized · demo',traditional:true,tokenized:true,eligible:false},
  NVDA:{name:'NVIDIA',price:120,dividend:.1,frequency:'Quarterly',note:'Traditional + tokenized · demo',traditional:true,tokenized:true,eligible:false}
};
let selected=['SPCX'],mode='traditional',allocations={SPCX:100};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
const years=()=>Number($('#horizon').value)||1;
function equalize(){const base=Math.floor(100/selected.length),remainder=100-base*selected.length;selected.forEach((t,i)=>allocations[t]=base+(i<remainder?1:0))}
function syncStockAllocationLabels(){$$('[data-stock]').forEach(b=>{const t=b.dataset.stock,el=b.querySelector('.allocation');if(el)el.textContent=selected.includes(t)?Math.round(allocations[t])+'%':''})}
function renderStocks(){
  $('#stockList').innerHTML=Object.entries(stocks).map(([ticker,s])=>`<button class="stock-choice ${selected.includes(ticker)?'active':''}" data-stock="${ticker}"><input type="checkbox" ${selected.includes(ticker)?'checked':''} aria-label="Select ${ticker}"><span class="ticker">${ticker.slice(0,2)}</span><span><b>${ticker} · ${s.name}</b><small>${s.note}</small></span><span class="allocation">${selected.includes(ticker)?Math.round(allocations[ticker])+'%':''}</span></button>`).join('');
  $$('.stock-choice').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const t=b.dataset.stock;if(selected.includes(t)){if(selected.length===1)return;selected=selected.filter(x=>x!==t)}else selected.push(t);equalize();renderStocks();renderAllocationInputs();renderDividendInputs();update()}));
}
function renderDividendInputs(){
  $('#dividendInputs').innerHTML=selected.map(t=>{const s=stocks[t];return `<div class="dividend-row"><span class="stock-tag">${t}</span><input data-dividend="${t}" type="number" min="0" step=".01" value="${s.dividend}" aria-label="${t} dividend per share" placeholder="Dividend / share"><select data-frequency="${t}" aria-label="${t} dividend frequency"><option ${s.frequency==='None'?'selected':''}>None</option><option ${s.frequency==='Monthly'?'selected':''}>Monthly</option><option ${s.frequency==='Quarterly'?'selected':''}>Quarterly</option><option ${s.frequency==='Annual'?'selected':''}>Annual</option></select></div>`}).join('');
  $$('[data-dividend]').forEach(i=>i.addEventListener('input',()=>{stocks[i.dataset.dividend].dividend=Math.max(0,Number(i.value)||0);update()}));
  $$('[data-frequency]').forEach(i=>i.addEventListener('change',()=>{stocks[i.dataset.frequency].frequency=i.value;update()}));
}
function renderAllocationInputs(){
  $('#allocationInputs').innerHTML=selected.length<2?'':`<div class="allocation-title">Split your total</div>`+selected.map(t=>`<div class="allocation-row"><span>${t}</span><input data-allocation="${t}" type="range" min="0" max="100" value="${Math.round(allocations[t])}"><b data-allocation-value="${t}">${Math.round(allocations[t])}%</b></div>`).join('');
  $$('[data-allocation]').forEach(i=>i.addEventListener('input',()=>{const t=i.dataset.allocation,chosen=Math.max(0,Math.min(100,Number(i.value)||0)),others=selected.filter(x=>x!==t);allocations[t]=chosen;if(others.length){const base=Math.floor((100-chosen)/others.length),remainder=100-chosen-base*others.length;others.forEach((other,index)=>{allocations[other]=base+(index<remainder?1:0);const otherInput=document.querySelector(`[data-allocation="${other}"]`);if(otherInput)otherInput.value=allocations[other];const otherValue=document.querySelector(`[data-allocation-value="${other}"]`);if(otherValue)otherValue.textContent=Math.round(allocations[other])+'%'})}document.querySelector(`[data-allocation-value="${t}"]`).textContent=Math.round(allocations[t])+'%';syncStockAllocationLabels();update()}));
}
const frequencyPerYear={None:0,Monthly:12,Quarterly:4,Annual:1};
const units=v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(v);
function dividendPerYear(s){return s.dividend*(frequencyPerYear[s.frequency]||0)}
function paymentCount(s,h){return Math.max(0,Math.floor((frequencyPerYear[s.frequency]||0)*h+1e-9))}
function scenarioPrice(s,shock,fraction){return Math.max(.000001,s.price*(1+(shock/100)*fraction))}
function projectTraditional(s,invest,h,shock,eligible){
  const initialShares=s.price?invest/s.price:0,count=paymentCount(s,h),cashDividend=eligible?initialShares*s.dividend*count:0,finalPrice=scenarioPrice(s,shock,1);
  return {t:s.t,initialShares,endingShares:initialShares,stockValue:initialShares*finalPrice,cashDividend,reinvestedShares:0,reinvestedValue:0,endingValue:initialShares*finalPrice+cashDividend,paymentCount:count,finalPrice};
}
function projectTokenized(s,invest,h,shock){
  const initialShares=s.price?invest/s.price:0,count=paymentCount(s,h),finalPrice=scenarioPrice(s,shock,1);let endingShares=initialShares,grossDividend=0,reinvestedShares=0;
  for(let i=1;i<=count;i++){
    const payoutPrice=scenarioPrice(s,shock,i/count),dividend=endingShares*s.dividend;
    grossDividend+=dividend;
    const added=payoutPrice?dividend/payoutPrice:0;
    endingShares+=added;reinvestedShares+=added;
  }
  return {t:s.t,initialShares,endingShares,stockValue:initialShares*finalPrice,grossDividend,reinvestedShares,reinvestedValue:reinvestedShares*finalPrice,endingValue:endingShares*finalPrice,paymentCount:count,finalPrice};
}
function summarizeUnits(projects,key){return projects.filter(x=>x[key]>0).map(x=>`${x.t} ${units(x[key])}`).join(' · ')||'None'}
function update(){
  const amount=Math.max(0,Number($('#amount').value)||0),h=years(),shock=Number($('#price').value)||0;
  const unsupported=selected.filter(t=>mode==='traditional'&&!stocks[t].traditional),basket=selected.map(t=>{const s={...stocks[t],t},invest=amount*(allocations[t]||0)/100;return mode==='tokenized'?projectTokenized(s,invest,h,shock):projectTraditional(s,invest,h,shock,!unsupported.includes(t))});
  const totalDiv=basket.reduce((a,x)=>a+(mode==='tokenized'?x.grossDividend:x.cashDividend),0),priceValue=basket.reduce((a,x)=>a+x.stockValue,0),finalValue=basket.reduce((a,x)=>a+x.endingValue,0),reinvestedValue=basket.reduce((a,x)=>a+(x.reinvestedValue||0),0);
  const period=h<1?`${h*12} months`:`${h} year${h>1?'s':''}`,isToken=mode==='tokenized';
  $('#priceOut').textContent=`${shock>0?'+':''}${shock}%`;$('#startValue').textContent=money(amount);$('#stockName').textContent=`${selected.length} stock${selected.length>1?'s':''} · ${period}`;
  $('#allocationNote').textContent=selected.length>1?`Your ${money(amount)} is split ${selected.map(t=>`${t} ${Math.round(allocations[t])}%`).join(' · ')}.`:`${money(amount)} is allocated to ${selected[0]}. You can select more stocks to diversify.`;
  $('#marketVal').textContent=money(priceValue);$('#collateralValue').textContent=money(priceValue*.7);$('#collateralBar').style.width='70%';
  $('#eligible').textContent=selected.length===1&&selected[0]==='SPCX'?'DOCUMENTED EXAMPLE':'CHECK LIVE ELIGIBILITY';
  $('#collateralAction').textContent=`Your position is ${money(priceValue)}. With an illustrative 30% haircut, about ${money(priceValue*.7)} may be recognized as collateral for an eligible Backpack trade or borrow. It is not a cash payout.`;
  $('#collateralNote').textContent=selected.length===1&&selected[0]==='SPCX'?'SPCX is shown as an example of a documented eligible collateral asset. Rules can change by asset and region.':'This simulator does not assume collateral eligibility for a basket. Confirm live Backpack terms before borrowing.';
  const timelineDividend=totalDiv?`${money(totalDiv)} is the illustrative dividend value for your basket over ${period}.`:'No dividend is entered for this basket.';
  const timelineRail=isToken?`Reinvestment is modeled per asset. Ending token units: ${summarizeUnits(basket,'endingShares')}.`:'Eligible cash dividends are shown separately from the share value.';
  $('#timeline').innerHTML=[['01','Choose','You split your investment across the stocks you select.'],['02','Buy before the record date','You must hold the eligible security when the company checks shareholders.'],['03','Company declares a dividend',timelineDividend],['04',isToken?'Reinvest into tokens':'Cash through brokerage',timelineRail]].map(x=>`<div class="time-step"><b>${x[0]} · ${x[1]}</b>${x[2]}</div>`).join('');
  $('#stepNo').textContent='04';
  const traditionalOutcome=`<div><h3>Estimated traditional position</h3><p>Stock-price value: <b>${money(priceValue)}</b><br>Estimated cash dividend: <b>${money(totalDiv)}</b><br>Total illustrated value: <b>${money(finalValue)}</b></p></div><strong>${money(finalValue)}</strong>`;
  const tokenOutcome=`<div><h3>Estimated tokenized position</h3><p>Price-only value: <b>${money(priceValue)}</b><br>Reinvested dividend value: <b>${money(reinvestedValue)}</b><br>Starting units: <b>${summarizeUnits(basket,'initialShares')}</b><br>Estimated ending units: <b>${summarizeUnits(basket,'endingShares')}</b></p></div><strong>${money(finalValue)}</strong>`;
  $('#outcome').innerHTML=isToken?tokenOutcome:traditionalOutcome;
  const modeWarning=unsupported.length?`<div class="mode-warning"><b>${unsupported.join(', ')} is shown as tokenized-only in this demo.</b> Its dividend input is excluded from the traditional estimate. Switch to “Tokenized on Solana” or choose a traditional-rail stock.</div>`:'';
  $('#modeExplain').innerHTML=modeWarning+(isToken?`<b>Tokenized path:</b> Backpack’s current materials say dividends for Backpack-issued tokenized securities are automatically reinvested into additional tokenized shares. This illustration estimates reinvested units per asset; it is not a separate cash or USDC payout. Actual timing, terms, fees, taxes, and eligibility can change the result. <a href="https://learn.backpack.exchange/blog/tokenized-spacex-spcx" target="_blank" rel="noopener noreferrer">Read Backpack’s explanation ↗</a>`:`<b>Traditional path:</b> Backpack’s current materials say eligible cash dividends are processed through brokerage infrastructure. This illustration shows cash separately from share value; actual eligibility, timing, taxes, and security terms control. <a href="https://backpack.exchange/stocks/about" target="_blank" rel="noopener noreferrer">See current stock terms ↗</a>`);
}
$$('.mode-switch button').forEach(b=>b.addEventListener('click',()=>{$$('.mode-switch button').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.mode;update()}));
$('#horizon').addEventListener('change',update);
['#amount','#price'].forEach(s=>$(s).addEventListener('input',update));
renderStocks();renderAllocationInputs();renderDividendInputs();update();
function showTipPanel(){const panel=$('#tipPanel');panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'center'})}
$('#tipButton').addEventListener('click',()=>{$('#tipPanel').hidden=!$('#tipPanel').hidden});
$('#topTipButton').addEventListener('click',showTipPanel);
$('#copyTip').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('HzMQZEXiyGRcvkjC4puwuVEBkQn95DRRaDf8DcKkcRZm');$('#copyStatus').textContent='Copied'}catch(e){$('#copyStatus').textContent='Copy unavailable — select the address'}});
