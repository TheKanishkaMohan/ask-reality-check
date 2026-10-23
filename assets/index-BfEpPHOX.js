(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))u(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const p of o.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&u(p)}).observe(document,{childList:!0,subtree:!0});function i(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function u(n){if(n.ep)return;n.ep=!0;const o=i(n);fetch(n.href,o)}})();const ie={INR_CR:{id:"INR_CR",label:"₹ Crore (₹ Cr)",shortUnit:"₹ Cr",symbol:"₹",suffix:" Cr",locale:"en-IN",indianSubUnitLabel:"₹ Cr (or Lakhs/mo)"},INR_LAKH:{id:"INR_LAKH",label:"₹ Lakh (₹ L)",shortUnit:"₹ Lakh",symbol:"₹",suffix:" Lakh",locale:"en-IN",indianSubUnitLabel:"₹ Lakh"},USD_M:{id:"USD_M",label:"US Dollars ($M)",shortUnit:"$M",symbol:"$",suffix:"M",locale:"en-US",indianSubUnitLabel:"$M"}};function B(e,t=1,i="en-IN"){return e==null||!Number.isFinite(e)?"—":(Math.abs(e)<1e-9?0:e).toLocaleString(i,{minimumFractionDigits:0,maximumFractionDigits:t})}function r(e,t="INR_CR",i){if(e==null||!Number.isFinite(e))return"—";const u=ie[t],n=Math.abs(e),o=i!==void 0?i:n>=100&&Math.abs(n-Math.round(n))<.05?0:n<1&&n>0?2:1,p=e<0?"-":"",f=B(n,o,u.locale);return`${p}${u.symbol}${f}${u.suffix}`}function V(e,t="INR_CR"){if(e==null||!Number.isFinite(e))return"—";if(t==="INR_CR"){if(e>0&&e<1){const i=e*100;return`₹${B(i,1,"en-IN")} Lakh/mo (₹${B(e,2,"en-IN")} Cr/mo)`}return`${r(e,"INR_CR",2)}/mo`}if(t==="USD_M"){if(e>0&&e<1){const i=e*1e3;return`$${B(i,0,"en-US")}K/mo ($${B(e,2,"en-US")}M/mo)`}return`${r(e,"USD_M",2)}/mo`}return`${r(e,t,1)}/mo`}function l(e,t=1){return e==null||!Number.isFinite(e)?"—":`${B(e,t,"en-US")}x`}function M(e,t=0){return e==null||!Number.isFinite(e)?"—":`${B(e,t,"en-US")}%`}function J(e,t,i){return t===i?e:t==="INR_CR"&&i==="INR_LAKH"?Number((e*100).toFixed(4)):t==="INR_LAKH"&&i==="INR_CR"?Number((e/100).toFixed(4)):e}const D={reachableMax:3,stretchMax:5},ee=[{id:"a",name:"Example A: ₹50 Cr ask on ₹75L/mo",shortLabel:"Note: ₹50 Cr ask",description:"The note’s opening example: ₹50 Cr ask on ₹75 lakh/month (₹9 Cr ARR). At 20–25% dilution the ask implies ₹200–250 Cr post-money, requiring ₹400–500 Cr next-round pre-money in 15–18 months. (The 7x next-round multiple is our placeholder.)",unit:"INR_CR",input:{ask:50,dilutionPct:20,annualRevenue:9,priorRaise:0,priorRaiseWasPriced:!0,stepUpMultiple:2,nextRoundMultiple:7,monthsToNextRound:18,cashNeeded:0,esopTopUpPct:0,verdictBands:{...D}}},{id:"b",name:"Example B: Consumer brand sized to milestone",shortLabel:"Note: sized to milestone",description:"The note’s consumer brand: doing ₹1 Cr/month (₹12 Cr ARR), raising ₹20 Cr at ₹80 Cr pre-money (~6.7x pre-money / 8.3x post-money) and ₹100 Cr post-money. Next round needs ₹200 Cr pre-money at 6x (~₹33.3 Cr ARR, or ~₹2.8–3 Cr/mo). But the burn plan requires ₹40 Cr to get there, leaving a ₹20 Cr shortfall.",unit:"INR_CR",input:{ask:20,dilutionPct:20,annualRevenue:12,priorRaise:0,priorRaiseWasPriced:!0,stepUpMultiple:2,nextRoundMultiple:6,monthsToNextRound:18,cashNeeded:40,esopTopUpPct:0,verdictBands:{...D}}},{id:"c",name:"Example C: ₹150 Cr cautionary pitch",shortLabel:"Note: ₹150 Cr ask",description:'The note’s cautionary consumer services pitch: ₹150 Cr ask on ₹1.5 Cr/month (₹18 Cr ARR) implies ₹600–750 Cr post-money. Clearing a ₹1,200+ Cr next round even at a generous 12x multiple demands ₹100 Cr ARR (~5.6x growth in 15–18 months — "Stiff").',unit:"INR_CR",input:{ask:150,dilutionPct:25,annualRevenue:18,priorRaise:0,priorRaiseWasPriced:!0,stepUpMultiple:2,nextRoundMultiple:12,monthsToNextRound:18,cashNeeded:0,esopTopUpPct:0,verdictBands:{...D}}}],ke=[{id:"dilution_band",parameter:"Early-stage dilution band (20%–25%)",defaultValue:"20% (4x–5x ask)",origin:"Source Article",explanation:"Sajith Pai notes that early-stage rounds typically involve 20%–25% dilution, so VCs multiply your ask by 4x–5x to read your implied post-money valuation (with 33% as a high-dilution edge case)."},{id:"step_up",parameter:"Minimum next-round valuation step-up",defaultValue:"2.0x post-money",origin:"Source Article",explanation:"Incoming VCs underwrite the current round by asking whether the next round’s pre-money valuation can be at least 2x the present post-money valuation."},{id:"horizon",parameter:"Time to next round benchmark",defaultValue:"15–18 months",origin:"Source Article",explanation:"Standard seed/early-stage runway window over which the 2x+ valuation bump is evaluated. Staged tranches or deep-tech/hardware horizons may differ."},{id:"prior_raise_band",parameter:"Ask vs. previous priced raise ratio",defaultValue:"3.0x–4.0x",origin:"Source Article",explanation:"If you raised ₹10 Cr in a priced pre-seed round, a typical next-round ask is ₹30–40 Cr (aligning with a 2–3x valuation bump). Does not apply to grants or unpriced angel notes."},{id:"esop_pool",parameter:"Pre-money ESOP pool top-up deduction",defaultValue:"0% (optional input)",origin:"Source Article (Comments)",explanation:"As noted by Adityavikram Banka and confirmed by Sajith Pai in the article comments, a pre-money ESOP pool top-up comes out of existing shareholders’ stake, lowering effective pre-money valuation."},{id:"verdict_bands",parameter:"Growth verdict bands (Reachable ≤ 3x, Stretch ≤ 5x, Stiff > 5x)",defaultValue:"3.0x / 5.0x",origin:"Our Assumption",explanation:'Inferred from the article’s examples: ~2.8x–3x in Example B is treated as an achievable milestone, whereas ~5.5x in Example C is called "Stiff". Configurable in Settings.'},{id:"example_a_multiple",parameter:"Example A next-round revenue multiple",defaultValue:"7.0x ARR",origin:"Our Assumption",explanation:'The article leaves the next-round revenue multiple in Example A open ("?"). We use 7x (matching the starting multiple in Example B) as a placeholder.'},{id:"cagr_formula",parameter:"Compound annualised growth rate (CAGR)",defaultValue:"(Growth)^(12 / Months) − 1",origin:"Our Assumption",explanation:"Converts the total revenue multiple over the runway horizon into an equivalent annualised compounding rate."}];function Ae(e){const t=[],i=[];return(!Number.isFinite(e.ask)||e.ask<=0)&&t.push({field:"ask",message:"Enter a positive fundraise ask greater than 0."}),!Number.isFinite(e.dilutionPct)||e.dilutionPct<=0?t.push({field:"dilutionPct",message:"Dilution must be greater than 0% to imply a valuation."}):e.dilutionPct>=100?t.push({field:"dilutionPct",message:"Dilution must be below 100% (existing shareholders cannot be diluted 100%+)."}):e.dilutionPct>40?i.push({field:"dilutionPct",message:`Dilution of ${M(e.dilutionPct,1)} is unusually high for an early-stage round (typical band is 20%–25%, with 33% already considered very high).`}):e.dilutionPct<10&&i.push({field:"dilutionPct",message:`Dilution of ${M(e.dilutionPct,1)} is well below the typical 20%–25% early-stage institutional band.`}),(!Number.isFinite(e.annualRevenue)||e.annualRevenue<0)&&t.push({field:"annualRevenue",message:"Annualised revenue cannot be negative."}),(!Number.isFinite(e.priorRaise)||e.priorRaise<0)&&t.push({field:"priorRaise",message:"Previous raise cannot be negative (use 0 if none)."}),(!Number.isFinite(e.stepUpMultiple)||e.stepUpMultiple<1)&&t.push({field:"stepUpMultiple",message:"Required step-up multiple must be at least 1.0x (benchmark is 2.0x)."}),(!Number.isFinite(e.nextRoundMultiple)||e.nextRoundMultiple<=0)&&t.push({field:"nextRoundMultiple",message:"Next-round revenue multiple must be greater than 0x."}),!Number.isFinite(e.monthsToNextRound)||e.monthsToNextRound<1?t.push({field:"monthsToNextRound",message:"Months to next round must be at least 1 month."}):e.monthsToNextRound>60&&i.push({field:"monthsToNextRound",message:"A horizon beyond 60 months is outside normal venture round staging."}),(!Number.isFinite(e.cashNeeded)||e.cashNeeded<0)&&t.push({field:"cashNeeded",message:"Cash needed from burn plan cannot be negative."}),!Number.isFinite(e.esopTopUpPct)||e.esopTopUpPct<0?t.push({field:"esopTopUpPct",message:"ESOP pool top-up cannot be negative."}):e.esopTopUpPct>50&&t.push({field:"esopTopUpPct",message:"ESOP pool top-up cannot exceed 50% of post-money."}),Number.isFinite(e.dilutionPct)&&Number.isFinite(e.esopTopUpPct)&&e.dilutionPct>0&&e.dilutionPct<100&&e.esopTopUpPct>=0&&e.dilutionPct+e.esopTopUpPct>=100&&t.push({field:"esopAndDilution",message:`Round dilution (${M(e.dilutionPct,1)}) plus pre-money ESOP top-up (${M(e.esopTopUpPct,1)}) reaches ${M(e.dilutionPct+e.esopTopUpPct,1)}, leaving 0% or negative effective pre-money for existing shareholders.`}),(!Number.isFinite(e.verdictBands.reachableMax)||!Number.isFinite(e.verdictBands.stretchMax)||e.verdictBands.reachableMax<=0||e.verdictBands.stretchMax<=e.verdictBands.reachableMax)&&t.push({field:"verdictBands",message:"Verdict bands must have 0 < Reachable ceiling < Stretch ceiling."}),{valid:t.length===0,errors:t,warnings:i}}function oe(e,t,i,u,n){const o=t/100,p=e/o,f=p-e,m=i>0?p/i:null,c=i>0?f/i:null,g=p*u,v=g/n,R=v/12,A=i>0?v/i:null;return{postMoney:p,preMoney:f,impliedPostMultiple:m,impliedPreMultiple:c,nextPreMoney:g,requiredAnnualRevenue:v,requiredMonthlyRevenue:R,requiredGrowthMultiple:A}}function pe(e){const{annualRevenue:t,dilutionPct:i,stepUpMultiple:u,nextRoundMultiple:n,priorRaise:o,priorRaiseWasPriced:p,verdictBands:f}=e,m=i>0&&i<100?i/100:0;if(t<=0||m<=0||u<1||n<=0)return{reachableAsk:0,stretchAsk:0,priorRaiseBand:o>0&&p?[o*3,o*4]:null};const v=t*f.reachableMax*n/u*m,w=t*f.stretchMax*n/u*m,s=o>0&&p?[o*3,o*4]:null;return{reachableAsk:v,stretchAsk:w,priorRaiseBand:s}}function ce(e,t="INR_CR"){const i=Ae(e),u=pe(e);if(!i.valid){const h=(U,a,d,x=!1,T="Source Article")=>({id:U,label:a,value:null,formattedValue:"—",subtitle:"Fix input errors to calculate",formula:d,calculation:"Waiting for valid inputs",isAssumption:x,assumptionOrigin:T}),W={impliedPostMoney:h("impliedPostMoney","Implied post-money","Ask ÷ (Dilution % ÷ 100)"),impliedPreMoney:h("impliedPreMoney","Implied pre-money","Implied Post-Money − Ask"),effectivePreMoneyAfterEsop:h("effectivePreMoneyAfterEsop","Effective pre-money (after ESOP)","Implied Pre-Money − (Implied Post-Money × ESOP % ÷ 100)",!1,"Source Article (Comments)"),impliedPostRevenueMultiple:h("impliedPostRevenueMultiple","Implied revenue multiple (post)","Implied Post-Money ÷ Annualised Revenue"),impliedPreRevenueMultiple:h("impliedPreRevenueMultiple","Implied revenue multiple (pre)","Implied Pre-Money ÷ Annualised Revenue"),nextRoundPreMoney:h("nextRoundPreMoney","Next-round pre-money","Implied Post-Money × Required Step-Up"),requiredNextAnnualRevenue:h("requiredNextAnnualRevenue","Revenue to earn it (annual)","Next-Round Pre-Money ÷ Next-Round Multiple"),requiredNextMonthlyRevenue:h("requiredNextMonthlyRevenue","Revenue to earn it (monthly)","Required Annualised Revenue ÷ 12"),requiredGrowthMultiple:h("requiredGrowthMultiple","Growth needed","Required Next Annualised Revenue ÷ Current Annualised Revenue"),impliedCagrPct:h("impliedCagrPct","Implied annual CAGR","(Growth Needed ^ (12 ÷ Months)) − 1",!0,"Our Assumption"),impliedCmgrPct:h("impliedCmgrPct","Implied monthly CMGR","(Growth Needed ^ (1 ÷ Months)) − 1",!0,"Our Assumption"),fundingGap:h("fundingGap","Milestone funding gap","max(0, Cash Needed − Ask)"),askToPriorRaiseMultiple:h("askToPriorRaiseMultiple","Ask vs. previous raise","Ask ÷ Previous Raise")};return{input:e,unit:t,validation:i,verdict:{level:"invalid",headline:"Check input values to run the calculation",summary:i.errors.map(U=>U.message).join(" "),reasons:i.errors.map((U,a)=>({id:`err_${a}`,text:U.message,tone:"bad",isAssumption:!1,origin:"Input validation"}))},metrics:W,sensitivity:[],feasibleAskBand:u}}const{ask:n,dilutionPct:o,annualRevenue:p,priorRaise:f,priorRaiseWasPriced:m,stepUpMultiple:c,nextRoundMultiple:g,monthsToNextRound:v,cashNeeded:R,esopTopUpPct:A,verdictBands:w}=e,s=oe(n,o,p,c,g),N=s.postMoney*(A/100),E=s.preMoney-N,P=s.requiredGrowthMultiple!==null&&s.requiredGrowthMultiple>0?Math.pow(s.requiredGrowthMultiple,12/v)-1:null,S=s.requiredGrowthMultiple!==null&&s.requiredGrowthMultiple>0?Math.pow(s.requiredGrowthMultiple,1/v)-1:null,C=R>0?R-n:null,H=C!==null?Math.max(0,C):null,_=f>0?n/f:null,Y={impliedPostMoney:{id:"impliedPostMoney",label:"Implied post-money",value:s.postMoney,formattedValue:r(s.postMoney,t),subtitle:`ask ÷ ${M(o,1)} dilution`,formula:"Implied Post-Money = Ask ÷ (Dilution % ÷ 100)",calculation:`${r(n,t)} ÷ ${(o/100).toFixed(4).replace(/\.?0+$/,"")} = ${r(s.postMoney,t)}`,isAssumption:!1,assumptionOrigin:"Source Article"},impliedPreMoney:{id:"impliedPreMoney",label:"Implied pre-money",value:s.preMoney,formattedValue:r(s.preMoney,t),subtitle:"post-money − ask",formula:"Implied Pre-Money = Implied Post-Money − Ask",calculation:`${r(s.postMoney,t)} − ${r(n,t)} = ${r(s.preMoney,t)}`,isAssumption:!1,assumptionOrigin:"Source Article"},effectivePreMoneyAfterEsop:{id:"effectivePreMoneyAfterEsop",label:"Effective pre-money (after ESOP)",value:E,formattedValue:r(E,t),subtitle:A>0?`after ${M(A,1)} post-money ESOP pool (${r(N,t)})`:"no pre-money ESOP top-up set",formula:"Effective Pre-Money = Implied Pre-Money − (Implied Post-Money × ESOP % ÷ 100)",calculation:`${r(s.preMoney,t)} − (${r(s.postMoney,t)} × ${(A/100).toFixed(4).replace(/\.?0+$/,"")}) = ${r(E,t)}`,isAssumption:!1,assumptionOrigin:"Source Article (Comments)"},impliedPostRevenueMultiple:{id:"impliedPostRevenueMultiple",label:"Implied revenue multiple",value:s.impliedPostMultiple,formattedValue:s.impliedPostMultiple!==null?`${l(s.impliedPostMultiple,1)} post`:"Enter revenue",subtitle:s.impliedPreMultiple!==null?`${l(s.impliedPreMultiple,1)} pre-money ÷ ARR`:"post-money ÷ annualised revenue",formula:"Post Multiple = Implied Post-Money ÷ ARR | Pre Multiple = Implied Pre-Money ÷ ARR",calculation:s.impliedPostMultiple!==null&&s.impliedPreMultiple!==null?`Post: ${r(s.postMoney,t)} ÷ ${r(p,t)} = ${l(s.impliedPostMultiple,2)} | Pre: ${r(s.preMoney,t)} ÷ ${r(p,t)} = ${l(s.impliedPreMultiple,2)}`:"Requires current annualised revenue > 0",isAssumption:!1,assumptionOrigin:"Source Article"},impliedPreRevenueMultiple:{id:"impliedPreRevenueMultiple",label:"Implied pre-money multiple",value:s.impliedPreMultiple,formattedValue:s.impliedPreMultiple!==null?l(s.impliedPreMultiple,1):"Enter revenue",subtitle:"pre-money ÷ annualised revenue",formula:"Implied Pre-Money Multiple = Implied Pre-Money ÷ Annualised Revenue",calculation:s.impliedPreMultiple!==null?`${r(s.preMoney,t)} ÷ ${r(p,t)} = ${l(s.impliedPreMultiple,2)}`:"Requires current annualised revenue > 0",isAssumption:!1,assumptionOrigin:"Source Article"},nextRoundPreMoney:{id:"nextRoundPreMoney",label:"Next-round pre-money",value:s.nextPreMoney,formattedValue:r(s.nextPreMoney,t),subtitle:`${l(c,1)} this post-money`,formula:"Next-Round Pre-Money = Implied Post-Money × Required Step-Up",calculation:`${r(s.postMoney,t)} × ${l(c,2)} = ${r(s.nextPreMoney,t)}`,isAssumption:c!==2,assumptionOrigin:c===2?"Source Article (2x minimum benchmark)":"Custom user override (Article benchmark is 2x)"},requiredNextAnnualRevenue:{id:"requiredNextAnnualRevenue",label:"Revenue to earn it",value:s.requiredAnnualRevenue,formattedValue:r(s.requiredAnnualRevenue,t),subtitle:`${V(s.requiredMonthlyRevenue,t)} at ${l(g,1)}`,formula:"Required Next ARR = Next-Round Pre-Money ÷ Next-Round Multiple",calculation:`${r(s.nextPreMoney,t)} ÷ ${l(g,2)} = ${r(s.requiredAnnualRevenue,t)} (${V(s.requiredMonthlyRevenue,t)})`,isAssumption:!0,assumptionOrigin:"Our Assumption / Sector Comparable Multiple"},requiredNextMonthlyRevenue:{id:"requiredNextMonthlyRevenue",label:"Monthly revenue to earn it",value:s.requiredMonthlyRevenue,formattedValue:V(s.requiredMonthlyRevenue,t),subtitle:"required annualised revenue ÷ 12",formula:"Required Next Monthly Revenue = Required Next ARR ÷ 12",calculation:`${r(s.requiredAnnualRevenue,t)} ÷ 12 = ${V(s.requiredMonthlyRevenue,t)}`,isAssumption:!1,assumptionOrigin:"Source Article"},requiredGrowthMultiple:{id:"requiredGrowthMultiple",label:"Growth needed",value:s.requiredGrowthMultiple,formattedValue:s.requiredGrowthMultiple!==null?l(s.requiredGrowthMultiple,1):"Enter revenue",subtitle:P!==null?`${M(P*100,0)}/yr (${M((S??0)*100,1)}/mo) over ${B(v,0)} mo`:"enter current revenue to compute growth",formula:"Growth Multiple = Required Next ARR ÷ Current ARR",calculation:s.requiredGrowthMultiple!==null?`${r(s.requiredAnnualRevenue,t)} ÷ ${r(p,t)} = ${l(s.requiredGrowthMultiple,2)}`:"Requires current annualised revenue > 0",isAssumption:!1,assumptionOrigin:"Source Article"},impliedCagrPct:{id:"impliedCagrPct",label:"Implied annual CAGR",value:P!==null?P*100:null,formattedValue:P!==null?`${M(P*100,0)}/yr`:"—",subtitle:`over ${B(v,0)} months`,formula:"Annual CAGR = (Growth Multiple ^ (12 ÷ Months)) − 1",calculation:P!==null&&s.requiredGrowthMultiple!==null?`(${s.requiredGrowthMultiple.toFixed(2)} ^ (12 ÷ ${v})) − 1 = ${M(P*100,1)}`:"Requires current annualised revenue > 0",isAssumption:!0,assumptionOrigin:"Our Assumption (compound annualisation)"},impliedCmgrPct:{id:"impliedCmgrPct",label:"Implied monthly CMGR",value:S!==null?S*100:null,formattedValue:S!==null?`${M(S*100,1)}/mo`:"—",subtitle:`compounded monthly for ${B(v,0)} mo`,formula:"Monthly CMGR = (Growth Multiple ^ (1 ÷ Months)) − 1",calculation:S!==null&&s.requiredGrowthMultiple!==null?`(${s.requiredGrowthMultiple.toFixed(2)} ^ (1 ÷ ${v})) − 1 = ${M(S*100,2)}`:"Requires current annualised revenue > 0",isAssumption:!0,assumptionOrigin:"Our Assumption (compound monthly rate)"},fundingGap:{id:"fundingGap",label:"Funding gap",value:H,formattedValue:R>0?H&&H>0?r(H,t):"None":"Not set",subtitle:R>0?C!==null&&C<0?`${r(Math.abs(C),t)} buffer above ${r(R,t)} burn`:`burn plan needs ${r(R,t)}`:"enter cash needed from burn plan",formula:"Funding Shortfall = max(0, Cash Needed − Ask)",calculation:R>0?`Cash Needed (${r(R,t)}) − Ask (${r(n,t)}) = ${r(C??0,t)}`:"Cash needed is 0 (optional field)",isAssumption:!1,assumptionOrigin:"Source Article (Example B burn check)"},askToPriorRaiseMultiple:{id:"askToPriorRaiseMultiple",label:"Ask vs. previous raise",value:_,formattedValue:_!==null?`${l(_,1)} (${m?"usual band 3–4x":"unpriced prior money"})`:"No prior raise",subtitle:f>0?`prior raise: ${r(f,t)}`:"enter previous raise if applicable",formula:"Ask vs. Previous Raise = Ask ÷ Previous Raise",calculation:_!==null?`${r(n,t)} ÷ ${r(f,t)} = ${l(_,2)}`:"Previous raise is 0",isAssumption:!1,assumptionOrigin:"Source Article (3–4x priced round rule)"}};let L,O;const q=[];if(p<=0||s.requiredGrowthMultiple===null)L="incomplete",O="Add current revenue to test whether growth can clear the next round",q.push({id:"valuation_signal",text:`Your ${r(n,t)} ask at ${M(o,1)} dilution immediately signals a ${r(s.postMoney,t)} post-money valuation (${r(s.preMoney,t)} pre-money), requiring ${r(s.nextPreMoney,t)} pre-money in the next round.`,tone:"neutral",isAssumption:!1,origin:"Source Article"}),q.push({id:"missing_revenue",text:`To earn ${r(s.nextPreMoney,t)} at ${l(g,1)}, you must reach ${r(s.requiredAnnualRevenue,t)} ARR (${V(s.requiredMonthlyRevenue,t)}). Enter your current revenue to see the required growth multiple.`,tone:"neutral",isAssumption:!1,origin:"Source Article"});else{const h=s.requiredGrowthMultiple;if(h<=w.reachableMax?(L="reachable",O=`Reachable: ${l(h,1)} revenue growth needed in ${B(v,0)} months`):h<=w.stretchMax?(L="stretch",O=`Stretch: ${l(h,1)} revenue growth needed in ${B(v,0)} months`):(L="stiff",O=`Stiff: ${l(h,1)} revenue growth needed in ${B(v,0)} months`),q.push({id:"valuation_signal",text:`Your ${r(n,t)} ask at ${M(o,1)} dilution signals a ${r(s.postMoney,t)} post-money (${r(s.preMoney,t)} pre-money), which is ${l(s.impliedPostMultiple,1)} post-money (${l(s.impliedPreMultiple,1)} pre-money) on current ${r(p,t)} ARR.`,tone:L==="reachable"?"good":L==="stretch"?"warn":"bad",isAssumption:!1,origin:"Source Article"}),s.impliedPostMultiple!==null&&s.impliedPostMultiple>g){const W=s.impliedPreMultiple!==null&&s.impliedPreMultiple>g?`Both your implied pre-money multiple (${l(s.impliedPreMultiple,1)}) and post-money multiple (${l(s.impliedPostMultiple,1)}) sit above the ${l(g,1)} next-round multiple.`:`Your implied post-money multiple (${l(s.impliedPostMultiple,1)}) sits above the ${l(g,1)} next-round multiple (pre-money is ${l(s.impliedPreMultiple,1)}).`;q.push({id:"multiple_compression",text:`${W} Because multiples compress from this round to the next, revenue has to grow ${l(h,1)} just to deliver a ${l(c,1)} valuation step-up.`,tone:h>w.reachableMax?"warn":"neutral",isAssumption:!1,origin:"Source Article (Multiple compression)"})}else s.impliedPostMultiple!==null&&s.impliedPostMultiple<=g&&q.push({id:"no_compression",text:`Your implied post-money multiple (${l(s.impliedPostMultiple,1)}) is at or below the ${l(g,1)} next-round multiple, so no multiple compression headwind is baked in.`,tone:"good",isAssumption:!1,origin:"Source Article"})}if(R>0)if(R>n){const h=R-n;q.push({id:"funding_shortfall",text:`Undercapitalised milestone: your ask (${r(n,t)}) is short of the ${r(R,t)} burn needed to hit the milestone by ${r(h,t)}. You either dilute more, raise more, or reset revenue expectations.`,tone:"bad",isAssumption:!1,origin:"Source Article (Example B burn check)"})}else if(R<n){const h=n-R;q.push({id:"funding_buffer",text:`Your ask includes a ${r(h,t)} runway cushion above the ${r(R,t)} milestone burn plan—useful buffer for execution uncertainty, though it raises the valuation bar you must clear.`,tone:"good",isAssumption:!0,origin:"Our Assumption / Article Comments"})}else q.push({id:"funding_exact",text:`Your ask (${r(n,t)}) exactly matches your ${r(R,t)} milestone burn plan with zero buffer for delays.`,tone:"neutral",isAssumption:!1,origin:"Source Article"});f>0&&_!==null&&(m?_>4?q.push({id:"prior_raise_high",text:`The ask is ${l(_,1)} your previous priced raise (${r(f,t)}), above the typical 3–4x band (${r(f*3,t)}–${r(f*4,t)}). Unless revenue is growing like a rocket, this jump is hard to justify.`,tone:"warn",isAssumption:!1,origin:"Source Article (3–4x previous raise rule)"}):_<3?q.push({id:"prior_raise_low",text:`The ask is ${l(_,1)} your previous priced raise (${r(f,t)}), below the usual 3–4x step-up band.`,tone:"neutral",isAssumption:!1,origin:"Source Article (3–4x previous raise rule)"}):q.push({id:"prior_raise_ok",text:`The ask is ${l(_,1)} your previous priced raise (${r(f,t)}), squarely inside the typical 3–4x band.`,tone:"good",isAssumption:!1,origin:"Source Article (3–4x previous raise rule)"}):q.push({id:"prior_raise_unpriced",text:`Previous capital (${r(f,t)}, ${l(_,1)} ratio) is marked as unpriced (grants, angel notes, or founder capital), so the 3–4x priced-round heuristic is not enforced.`,tone:"neutral",isAssumption:!0,origin:"Our Assumption (Priced vs. unpriced distinction)"})),A>0&&q.push({id:"esop_impact",text:`A ${M(A,1)} pre-money ESOP pool top-up reduces existing shareholders' effective pre-money from ${r(s.preMoney,t)} to ${r(E,t)}.`,tone:"warn",isAssumption:!1,origin:"Source Article (Comments)"}),(v<15||v>18)&&q.push({id:"horizon_outside_benchmark",text:`Horizon of ${B(v,0)} months is outside the standard 15–18 month seed convention (${v>18?"longer runway / staged capital":"accelerated bridge/sprint"}).`,tone:"neutral",isAssumption:!1,origin:"Source Article (15–18 month convention)"});const j=[20,25,33],G=(!j.some(h=>Math.abs(h-o)<.05)?[...j,o].sort((h,W)=>h-W):j).map(h=>{const W=Math.abs(h-o)<.05,U=oe(n,h,p,c,g);let a="";return Math.abs(h-20)<.05?a="5x ask (standard low dilution)":Math.abs(h-25)<.05?a="4x ask (standard high dilution)":Math.abs(h-33)<.05?a="~3x ask (very high for early stage)":a=`${l(100/h,1)} ask (your input)`,{dilutionPct:h,isUserSelected:W,note:a,...U}});return{input:e,unit:t,validation:i,verdict:{level:L,headline:O,summary:q.map(h=>h.text).join(" "),reasons:q},metrics:Y,sensitivity:G,feasibleAskBand:u}}function me(e,t,i,u="INR_CR"){const n=i!==void 0&&i>0?i:e.verdictBands.reachableMax,o=pe(e),{ask:p,dilutionPct:f,annualRevenue:m,stepUpMultiple:c,nextRoundMultiple:g}=e,v=f/100;if(c<1||g<=0||n<=0)return{target:t,targetGrowthMultiple:n,solvedValue:null,formattedSolvedValue:"—",summary:"Enter valid step-up and next-round multiple to run Goal-Seek.",formula:"",calculation:"",isFeasible:!1,infeasibleReason:"Invalid step-up or next-round multiple.",feasibleAskBand:o};if(t==="max_ask"){if(m<=0||v<=0||v>=1)return{target:t,targetGrowthMultiple:n,solvedValue:null,formattedSolvedValue:"—",summary:"Enter current revenue and valid dilution to solve for Maximum Ask.",formula:"Max Ask = Current ARR × Target Growth × Next Multiple × (Dilution ÷ Step-Up)",calculation:"Waiting for revenue > 0 and dilution in (0%, 100%)",isFeasible:!1,infeasibleReason:"Requires current annualised revenue > 0.",feasibleAskBand:o};const E=m*n*g/c,P=E*v;return{target:t,targetGrowthMultiple:n,solvedValue:P,formattedSolvedValue:r(P,u),secondaryFormattedValue:`${r(E,u)} post-money`,summary:`To keep required revenue growth at or below ${l(n,1)} (at ${M(f,1)} dilution and ${l(g,1)} next-round multiple), your ask cannot exceed ${r(P,u)} (implying ${r(E,u)} post-money).`,formula:"Max Ask = Current ARR × Target Growth × Next Multiple × (Dilution % ÷ 100) ÷ Step-Up",calculation:`${r(m,u)} × ${l(n,2)} × ${l(g,2)} × ${v.toFixed(4).replace(/\.?0+$/,"")} ÷ ${l(c,2)} = ${r(P,u)}`,isFeasible:P>0,feasibleAskBand:o}}if(t==="required_revenue"){if(p<=0||v<=0||v>=1)return{target:t,targetGrowthMultiple:n,solvedValue:null,formattedSolvedValue:"—",summary:"Enter a positive ask and valid dilution to solve for Required Current Revenue.",formula:"Required Current ARR = (Ask × Step-Up) ÷ ((Dilution % ÷ 100) × Next Multiple × Target Growth)",calculation:"Waiting for ask > 0 and dilution in (0%, 100%)",isFeasible:!1,infeasibleReason:"Requires positive ask and valid dilution.",feasibleAskBand:o};const P=p/v*c/g,S=P/n,C=S/12;return{target:t,targetGrowthMultiple:n,solvedValue:S,formattedSolvedValue:r(S,u),secondaryFormattedValue:V(C,u),summary:`To justify a ${r(p,u)} ask at ${M(f,1)} dilution with no more than ${l(n,1)} growth, you need ${r(S,u)} annualised revenue today (${V(C,u)}).`,formula:"Required Current ARR = (Ask ÷ (Dilution % ÷ 100)) × Step-Up ÷ (Next Multiple × Target Growth)",calculation:`${r(P,u)} target ARR ÷ ${l(n,2)} = ${r(S,u)} (${V(C,u)})`,isFeasible:S>0,feasibleAskBand:o}}if(p<=0||m<=0)return{target:t,targetGrowthMultiple:n,solvedValue:null,formattedSolvedValue:"—",summary:"Enter a positive ask and current revenue to solve for Required Dilution.",formula:"Required Dilution % = (Ask × Step-Up) ÷ (Current ARR × Target Growth × Next Multiple) × 100",calculation:"Waiting for ask > 0 and current revenue > 0",isFeasible:!1,infeasibleReason:"Requires positive ask and current revenue > 0.",feasibleAskBand:o};const A=m*n*g/c,w=p/A*100,s=w>0&&w<100-e.esopTopUpPct;return{target:t,targetGrowthMultiple:n,solvedValue:w,formattedSolvedValue:M(w,1),secondaryFormattedValue:`${r(A,u)} post-money`,summary:s?`To raise ${r(p,u)} on ${r(m,u)} ARR while capping required growth at ${l(n,1)}, you would need to accept ${M(w,1)} dilution (pricing the round at ${r(A,u)} post-money).`:`Even at 100% dilution, a ${r(p,u)} raise exceeds the ${r(A,u)} post-money valuation supported by ${l(n,1)} growth (requires ${M(w,1)} dilution). Lower the ask or raise revenue first.`,formula:"Required Dilution % = (Ask ÷ ((Current ARR × Target Growth × Next Multiple) ÷ Step-Up)) × 100",calculation:`(${r(p,u)} ÷ ${r(A,u)} max post-money) × 100 = ${M(w,2)}`,isFeasible:s,infeasibleReason:s?void 0:`Required dilution (${M(w,1)}) exceeds available equity.`,feasibleAskBand:o}}const y={unit:"u",preset:"p",ask:"ask",dilutionPct:"dil",annualRevenue:"rev",priorRaise:"prior",priorRaiseWasPriced:"priced",stepUpMultiple:"step",nextRoundMultiple:"mult",monthsToNextRound:"m",cashNeeded:"cash",esopTopUpPct:"esop",reachableMax:"rmax",stretchMax:"smax",goalSeekTarget:"gst",goalSeekGrowth:"gsg"};function Se(){const e=ee[0],t={...e.input,verdictBands:{...D}};if(typeof window>"u"||!window.location.search)return{unit:e.unit,activePresetId:e.id,input:t,goalSeekTarget:"max_ask",goalSeekGrowth:D.reachableMax};const i=new URLSearchParams(window.location.search);if([...i.keys()].length===0)return{unit:e.unit,activePresetId:e.id,input:t,goalSeekTarget:"max_ask",goalSeekGrowth:D.reachableMax};const u=i.get(y.preset),n=ee.find(P=>P.id===u),o=n?n.input:t,p=(P,S)=>{const C=i.get(P);if(C===null||C.trim()==="")return S;const H=Number(C);return Number.isFinite(H)?H:S},f=i.get(y.unit),m=f==="INR_CR"||f==="INR_LAKH"||f==="USD_M"?f:n?.unit??"INR_CR",c=i.get(y.priorRaiseWasPriced),g=c==="0"||c==="false"?!1:c==="1"||c==="true"?!0:o.priorRaiseWasPriced,v=i.get(y.goalSeekTarget),R=v==="max_ask"||v==="required_revenue"||v==="required_dilution"?v:"max_ask",A=p(y.reachableMax,o.verdictBands.reachableMax),w=p(y.stretchMax,o.verdictBands.stretchMax),s=p(y.goalSeekGrowth,A),N={ask:p(y.ask,o.ask),dilutionPct:p(y.dilutionPct,o.dilutionPct),annualRevenue:p(y.annualRevenue,o.annualRevenue),priorRaise:p(y.priorRaise,o.priorRaise),priorRaiseWasPriced:g,stepUpMultiple:p(y.stepUpMultiple,o.stepUpMultiple),nextRoundMultiple:p(y.nextRoundMultiple,o.nextRoundMultiple),monthsToNextRound:p(y.monthsToNextRound,o.monthsToNextRound),cashNeeded:p(y.cashNeeded,o.cashNeeded),esopTopUpPct:p(y.esopTopUpPct,o.esopTopUpPct),verdictBands:{reachableMax:A,stretchMax:w}},E=n&&m===n.unit&&N.ask===n.input.ask&&N.dilutionPct===n.input.dilutionPct&&N.annualRevenue===n.input.annualRevenue&&N.priorRaise===n.input.priorRaise&&N.stepUpMultiple===n.input.stepUpMultiple&&N.nextRoundMultiple===n.input.nextRoundMultiple&&N.monthsToNextRound===n.input.monthsToNextRound&&N.cashNeeded===n.input.cashNeeded&&N.esopTopUpPct===n.input.esopTopUpPct;return{unit:m,activePresetId:E?n.id:null,input:N,goalSeekTarget:R,goalSeekGrowth:s}}function we(e){const t=new URLSearchParams;return e.activePresetId&&t.set(y.preset,e.activePresetId),e.unit!=="INR_CR"&&t.set(y.unit,e.unit),t.set(y.ask,String(e.input.ask)),t.set(y.dilutionPct,String(e.input.dilutionPct)),t.set(y.annualRevenue,String(Number(e.input.annualRevenue.toFixed(4)))),e.input.priorRaise>0&&(t.set(y.priorRaise,String(e.input.priorRaise)),e.input.priorRaiseWasPriced||t.set(y.priorRaiseWasPriced,"0")),t.set(y.stepUpMultiple,String(e.input.stepUpMultiple)),t.set(y.nextRoundMultiple,String(e.input.nextRoundMultiple)),t.set(y.monthsToNextRound,String(e.input.monthsToNextRound)),e.input.cashNeeded>0&&t.set(y.cashNeeded,String(e.input.cashNeeded)),e.input.esopTopUpPct>0&&t.set(y.esopTopUpPct,String(e.input.esopTopUpPct)),e.input.verdictBands.reachableMax!==D.reachableMax&&t.set(y.reachableMax,String(e.input.verdictBands.reachableMax)),e.input.verdictBands.stretchMax!==D.stretchMax&&t.set(y.stretchMax,String(e.input.verdictBands.stretchMax)),e.goalSeekTarget!=="max_ask"&&t.set(y.goalSeekTarget,e.goalSeekTarget),e.goalSeekGrowth!==e.input.verdictBands.reachableMax&&t.set(y.goalSeekGrowth,String(e.goalSeekGrowth)),t.toString()}function ue(e){if(typeof window>"u"||!window.history?.replaceState)return;const t=we(e),i=`${window.location.pathname}${t?`?${t}`:""}${window.location.hash}`;window.history.replaceState(null,"",i)}function Ne(e,t,i="max_ask",u){const n=ce(e,t),o=me(e,i,u??e.verdictBands.reachableMax,t),p=ie[t].shortUnit,f=e.annualRevenue/12,m=[`# Ask Reality Check — Summary (${p})`,"",`**Verdict:** ${n.verdict.headline}`,"","## 1. Inputs",`- **Ask (Raise):** ${r(e.ask,t)}`,`- **Target Dilution:** ${M(e.dilutionPct,1)}`,`- **Current Revenue:** ${r(e.annualRevenue,t)} ARR (${V(f,t)})`,`- **Required Step-Up:** ${l(e.stepUpMultiple,1)} in ${e.monthsToNextRound} months`,`- **Next-Round Revenue Multiple:** ${l(e.nextRoundMultiple,1)} _(assumption)_`];return e.cashNeeded>0&&m.push(`- **Cash Needed (Burn Plan):** ${r(e.cashNeeded,t)}`),e.priorRaise>0&&m.push(`- **Previous Raise:** ${r(e.priorRaise,t)} (${e.priorRaiseWasPriced?"priced round":"unpriced"})`),e.esopTopUpPct>0&&m.push(`- **Pre-Money ESOP Pool Top-Up:** ${M(e.esopTopUpPct,1)} of post-money`),m.push("","## 2. What the Ask Signals","| Metric | Value | Formula / Note |","| :--- | :--- | :--- |",`| **Implied Post-Money** | ${n.metrics.impliedPostMoney.formattedValue} | ${n.metrics.impliedPostMoney.subtitle} |`,`| **Implied Pre-Money** | ${n.metrics.impliedPreMoney.formattedValue} | ${n.metrics.impliedPreMoney.subtitle} |`),e.esopTopUpPct>0&&m.push(`| **Effective Pre-Money (after ESOP)** | ${n.metrics.effectivePreMoneyAfterEsop.formattedValue} | ${n.metrics.effectivePreMoneyAfterEsop.subtitle} |`),m.push(`| **Implied Revenue Multiple** | ${n.metrics.impliedPostRevenueMultiple.formattedValue} | ${n.metrics.impliedPostRevenueMultiple.subtitle} |`,`| **Next-Round Pre-Money** | ${n.metrics.nextRoundPreMoney.formattedValue} | ${n.metrics.nextRoundPreMoney.subtitle} |`,`| **Revenue Needed at Next Round** | ${n.metrics.requiredNextAnnualRevenue.formattedValue} | ${n.metrics.requiredNextAnnualRevenue.subtitle} |`,`| **Required Revenue Growth** | ${n.metrics.requiredGrowthMultiple.formattedValue} | ${n.metrics.requiredGrowthMultiple.subtitle} |`,`| **Milestone Funding Gap** | ${n.metrics.fundingGap.formattedValue} | ${n.metrics.fundingGap.subtitle} |`),m.push("","## 3. Diagnostic Notes"),n.verdict.reasons.forEach(c=>{m.push(`- ${c.text} _(${c.origin})_`)}),n.validation.valid&&e.annualRevenue>0&&(m.push("","## 4. Goal-Seek & Feasible Ask Band",`- **Reachable Ask Ceiling (≤${l(e.verdictBands.reachableMax,1)} growth):** ${r(n.feasibleAskBand.reachableAsk,t)}`,`- **Stretch Ask Ceiling (≤${l(e.verdictBands.stretchMax,1)} growth):** ${r(n.feasibleAskBand.stretchAsk,t)}`),n.feasibleAskBand.priorRaiseBand&&m.push(`- **3–4x Priced Prior Raise Band:** ${r(n.feasibleAskBand.priorRaiseBand[0],t)} – ${r(n.feasibleAskBand.priorRaiseBand[1],t)}`),m.push(`- **Goal-Seek (${o.target.replace("_"," ")}):** ${o.summary}`)),n.sensitivity.length>0&&(m.push("","## 5. Dilution Sensitivity","| Dilution | Post-Money | Pre-Money | Pre / Post Multiple | Next Pre-Money | Growth Needed |","| :--- | ---: | ---: | ---: | ---: | ---: |"),n.sensitivity.forEach(c=>{const g=c.impliedPreMultiple!==null&&c.impliedPostMultiple!==null?`${l(c.impliedPreMultiple,1)} / ${l(c.impliedPostMultiple,1)}`:"—",v=c.requiredGrowthMultiple!==null?l(c.requiredGrowthMultiple,1):"—";m.push(`| ${M(c.dilutionPct,1)}${c.isUserSelected?" *(yours)*":""} | ${r(c.postMoney,t)} | ${r(c.preMoney,t)} | ${g} | ${r(c.nextPreMoney,t)} | ${v} |`)})),m.push("","---","_Generated by Ask Reality Check (client-side thinking aid based on Sajith Pai's note; not investment advice)._"),m.join(`
`)}function b(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function X(e,t,i,u,n,o){const p=o.has(e)?" open":"",f=u?"badge badge-assumption":"badge",m=u?"Our assumption":"Source article",c=n.trim().toLowerCase()!==m.toLowerCase();return`
    <details class="trace" data-trace-id="${b(e)}"${p}>
      <summary>How this is calculated</summary>
      <div class="trace-body">
        <div class="trace-formula">${b(t)}</div>
        <div class="trace-calc">${b(i)}</div>
        <div class="trace-origin">
          <span class="${f}">${b(m)}</span>
          ${c?`<span>${b(n)}</span>`:""}
        </div>
      </div>
    </details>
  `}function K(e,t){const i=e.isAssumption?`<span class="badge badge-assumption" title="${b(e.assumptionOrigin)}">Assumption</span>`:"";return`
    <div class="tile" data-metric-id="${b(e.id)}">
      <div class="tile-main">
        <span class="l">
          <span>${b(e.label)}</span>
          ${i}
        </span>
        <span class="v">${b(e.formattedValue)}</span>
        <span class="n">${b(e.subtitle)}</span>
      </div>
      ${X(`tile_${e.id}`,e.formula,e.calculation,e.isAssumption,e.assumptionOrigin,t)}
    </div>
  `}function Ce(e,t){const i={unit:t.unit,activePresetId:t.activePresetId,input:{...t.input,verdictBands:{...t.input.verdictBands}},goalSeekTarget:t.goalSeekTarget,goalSeekGrowth:t.goalSeekGrowth},u=new Set;let n="system";const o=ke.map(a=>{const x=a.origin==="Our Assumption"?"badge badge-assumption":"badge";return`
      <tr>
        <td><strong>${b(a.parameter)}</strong></td>
        <td><code>${b(a.defaultValue)}</code></td>
        <td><span class="${x}">${b(a.origin)}</span></td>
        <td>${b(a.explanation)}</td>
      </tr>
    `}).join("");e.innerHTML=`
    <div class="wrap">
      <div class="top-bar">
        <div class="brand-pill">
          <img src="./logo-mark.png" alt="" class="brand-logo brand-logo-light" width="20" height="20" />
          <img src="./logo-mark-inverted.png" alt="" class="brand-logo brand-logo-dark" width="20" height="20" />
          <span>Pareto’s Edge · Incrementally Original</span>
        </div>
        <div class="header-actions">
          <button type="button" id="copy-link-btn" class="icon-btn" aria-label="Copy shareable scenario link">
            Copy Link
          </button>
          <button type="button" id="copy-md-btn" class="icon-btn" aria-label="Copy summary as Markdown">
            Copy Markdown
          </button>
          <button type="button" id="print-btn" class="icon-btn" aria-label="Print or save as PDF">
            Print / PDF
          </button>
          <button type="button" id="theme-toggle" class="icon-btn" aria-label="Toggle color theme">
            Theme: Auto
          </button>
        </div>
      </div>

      <header class="hero">
        <p class="eyebrow">Fundraise sanity check</p>
        <h1>Ask Reality Check</h1>
        <div class="rule"></div>
        <p class="sub">
          Your ask sets the valuation a VC hears. This tool works backwards from the ask to the next round, following
          <a href="https://www.linkedin.com/pulse/rookie-fundraising-mistake-even-some-experienced-founders-sajith-pai-nvl2c/" target="_blank" rel="noopener noreferrer">Sajith Pai’s note on the rookie fundraising mistake</a>.
          <span id="unit-banner-text">All monetary amounts are in ₹ Cr.</span>
        </p>
      </header>

      <div class="toolbar-row">
        <section class="presets-bar" aria-label="Worked examples from the article" style="flex: 1; min-width: 260px;">
          <div class="presets" id="presets" role="group" aria-label="Examples"></div>
        </section>

        <div class="action-group" role="group" aria-label="Currency and unit selection">
          <span style="font-size: 12.5px; font-weight: 600; color: var(--muted);">Units:</span>
          <div class="segmented" id="unit-switcher">
            <button type="button" data-unit="INR_CR" aria-pressed="true">₹ Cr</button>
            <button type="button" data-unit="INR_LAKH" aria-pressed="false">₹ Lakh</button>
            <button type="button" data-unit="USD_M" aria-pressed="false">USD ($M)</button>
          </div>
        </div>
      </div>

      <p id="pnote" class="preset-note" hidden></p>

      <div class="cols">
        <section class="card" aria-label="Inputs">
          <div class="card-header">
            <p class="eyebrow">Inputs</p>
            <small id="unit-hint" style="color: var(--muted); font-size: 12.5px;">Amounts in ₹ Cr</small>
          </div>

          <div class="field-group">
            <div class="pair">
              <div class="field">
                <label for="ask">Ask (raise)</label>
                <input id="ask" type="number" step="any" min="0" inputmode="decimal" />
                <small id="ask-unit-sub">₹ Cr intended raise</small>
                <div class="field-error" id="err-ask" hidden></div>
              </div>
              <div class="field">
                <label for="dil">Dilution</label>
                <input id="dil" type="number" step="any" min="0.1" max="99.9" inputmode="decimal" />
                <small>% (early rounds: 20–25%)</small>
                <div class="field-error" id="err-dil" hidden></div>
              </div>
            </div>

            <div class="pair">
              <div class="field">
                <label for="mrr">Monthly revenue now</label>
                <input id="mrr" type="number" step="any" min="0" inputmode="decimal" />
                <small id="mrr-sub">₹ Cr/mo (e.g. 0.75 = ₹75 Lakh/mo)</small>
              </div>
              <div class="field">
                <label for="rev">Annualised revenue now</label>
                <input id="rev" type="number" step="any" min="0" inputmode="decimal" />
                <small id="rev-sub">₹ Cr (monthly × 12)</small>
                <div class="field-error" id="err-rev" hidden></div>
              </div>
            </div>

            <div class="pair">
              <div class="field">
                <label for="prior">Previous raise</label>
                <input id="prior" type="number" step="any" min="0" inputmode="decimal" />
                <small id="prior-sub">₹ Cr (0 if none)</small>
                <div class="field-error" id="err-prior" hidden></div>
              </div>
              <div class="field">
                <label for="cash">Cash needed to hit milestone</label>
                <input id="cash" type="number" step="any" min="0" inputmode="decimal" />
                <small id="cash-sub">₹ Cr from your burn plan (0 if unset)</small>
                <div class="field-error" id="err-cash" hidden></div>
              </div>
            </div>

            <div class="switch-row" id="priced-switch-row">
              <input id="priced" type="checkbox" checked />
              <div>
                <label for="priced">Previous raise was a priced equity round</label>
                <small>Applies the article’s 3–4x previous-raise rule. Uncheck for grants, convertible notes, or founder capital.</small>
              </div>
            </div>

            <div class="pair">
              <div class="field">
                <label for="step">
                  <span>Required step-up</span>
                </label>
                <input id="step" type="number" step="any" min="1" inputmode="decimal" />
                <small>next pre-money ÷ this post-money (2x benchmark)</small>
                <div class="field-error" id="err-step" hidden></div>
              </div>
              <div class="field">
                <label for="mult">
                  <span>Next-round revenue multiple</span>
                  <span class="badge badge-assumption">Assumption</span>
                </label>
                <input id="mult" type="number" step="any" min="0.1" inputmode="decimal" />
                <small>x ARR; multiples typically compress round-to-round</small>
                <div class="field-error" id="err-mult" hidden></div>
              </div>
            </div>

            <div class="sector-caveat">
              <strong>Multiple caveat:</strong> Revenue multiples best fit venture-style software and high-margin consumer brands. For asset-heavy, manufacturing, or low-margin businesses, override the multiple above with sector-specific comparables.
            </div>

            <div class="pair">
              <div class="field">
                <label for="months">Months to next round</label>
                <input id="months" type="number" step="1" min="1" max="120" inputmode="numeric" />
                <small>15–18 months is the seed convention</small>
                <div class="field-error" id="err-months" hidden></div>
              </div>
              <div class="field">
                <label for="esop">ESOP top-up created pre-money</label>
                <input id="esop" type="number" step="any" min="0" max="50" inputmode="decimal" />
                <small>% of post-money; lowers effective pre-money</small>
                <div class="field-error" id="err-esop" hidden></div>
              </div>
            </div>
          </div>
        </section>

        <section class="card" aria-label="Results" aria-live="polite" id="results-panel">
          <div class="card-header">
            <p class="eyebrow">What your ask signals</p>
            <span class="badge badge-assumption" id="verdict-band-badge">Verdict bands: ≤3x / ≤5x (our assumption)</span>
          </div>

          <div class="verdict-box" id="verdict-box">
            <div class="verdict-head">
              <div class="dot" id="vdot" data-level="reachable"></div>
              <div class="verdict-title-wrap">
                <h2 id="vh"></h2>
              </div>
            </div>
            <ul class="reasons-list" id="vreasons"></ul>
          </div>

          <div class="tiles" id="tiles"></div>

          <!-- Step 3: Integrated Goal-Seek Mode -->
          <div class="goalseek-section" aria-label="Goal-seek calculator">
            <div class="card-header">
              <p class="eyebrow">Your ask is a goal-seek</p>
              <span class="badge">Backwards solver</span>
            </div>

            <div class="band-pills" id="band-pills"></div>

            <div class="solver-controls">
              <div class="field">
                <label for="gs-target">Solve backwards for</label>
                <select id="gs-target" class="solver-select">
                  <option value="max_ask">Largest ask that clears growth ceiling</option>
                  <option value="required_revenue">Current revenue needed for this ask</option>
                  <option value="required_dilution">Dilution needed for this ask &amp; revenue</option>
                </select>
              </div>
              <div class="field">
                <label for="gs-growth">
                  <span>Target max growth (x)</span>
                  <span class="badge badge-assumption">Assumption</span>
                </label>
                <input id="gs-growth" type="number" step="0.1" min="0.5" max="50" inputmode="decimal" />
              </div>
            </div>

            <div class="solver-output" id="gs-output"></div>
          </div>

          <div class="chain-section">
            <p class="eyebrow">Valuation &amp; cap-table chain</p>
            <ul class="chain" id="chain"></ul>
          </div>

          <div class="sens-section">
            <div class="card-header">
              <p class="eyebrow">If the dilution were different</p>
              <small style="color: var(--muted); font-size: 12px;">20%, 25%, 33% benchmarks + your input</small>
            </div>
            <div class="scroll">
              <table class="sens-table" id="sens" aria-label="Dilution sensitivity table"></table>
            </div>
            <div id="sens-trace-wrap"></div>
          </div>

          <p class="sub" style="font-size: 13px;">
            Rules of thumb from the source article: 20–25% early dilution (4–5x ask), next pre-money at least 2x this post-money in 15–18 months, and asks of 3–4x the previous priced raise. The growth verdict bands are <strong>our assumption</strong> inferred from the article’s examples and can be customised below.
          </p>
        </section>
      </div>

      <!-- Step 4: Settings & Assumptions Reference -->
      <details class="panel-drawer" id="settings-drawer">
        <summary>
          <span>Settings &amp; Verdict Band Thresholds</span>
          <span class="badge badge-assumption">Configurable assumptions</span>
        </summary>
        <div class="drawer-content">
          <div class="pair">
            <div class="field">
              <label for="band-reach">
                <span>Reachable growth ceiling (x)</span>
                <span class="badge badge-assumption">Our assumption</span>
              </label>
              <input id="band-reach" type="number" step="0.1" min="0.5" max="20" inputmode="decimal" />
              <small>Growth at or below this multiple is marked Reachable (default 3.0x)</small>
            </div>
            <div class="field">
              <label for="band-stretch">
                <span>Stretch growth ceiling (x)</span>
                <span class="badge badge-assumption">Our assumption</span>
              </label>
              <input id="band-stretch" type="number" step="0.1" min="1" max="50" inputmode="decimal" />
              <small>Growth above this multiple is marked Stiff (default 5.0x)</small>
              <div class="field-error" id="err-bands" hidden></div>
            </div>
          </div>
          <div>
            <button type="button" id="reset-bands-btn" class="icon-btn">Reset verdict bands to 3.0x / 5.0x</button>
          </div>
        </div>
      </details>

      <details class="panel-drawer" id="assumptions-drawer">
        <summary>
          <span>All Defaults, Rules of Thumb &amp; Origins</span>
          <span class="badge">Source Article vs. Our Assumptions</span>
        </summary>
        <div class="drawer-content">
          <div class="scroll">
            <table class="assumptions-table" aria-label="Defaults and origins reference">
              <thead>
                <tr>
                  <th>Parameter / Rule</th>
                  <th>Default</th>
                  <th>Origin</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${o}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <footer class="app-footer">
        <div class="footer-row">
          <span class="privacy-pill">100% Client-Side · Offline Ready · Zero Network Calls</span>
          <span>Design system: <strong>TheKanishkaMohan</strong> · Pareto’s Edge</span>
        </div>
        <p style="margin: 0;">
          <strong>Disclaimer:</strong> Unofficial thinking aid based on Sajith Pai’s published LinkedIn note. Not affiliated with Sajith Pai or Blume Ventures, and not financial or investment advice. Nothing you type leaves your browser.
        </p>
      </footer>
    </div>
  `;const p=e.querySelector("#ask"),f=e.querySelector("#dil"),m=e.querySelector("#mrr"),c=e.querySelector("#rev"),g=e.querySelector("#prior"),v=e.querySelector("#priced"),R=e.querySelector("#step"),A=e.querySelector("#mult"),w=e.querySelector("#months"),s=e.querySelector("#cash"),N=e.querySelector("#esop"),E=e.querySelector("#gs-target"),P=e.querySelector("#gs-growth"),S=e.querySelector("#band-reach"),C=e.querySelector("#band-stretch"),H=e.querySelector("#reset-bands-btn"),_=e.querySelector("#presets"),Y=e.querySelector("#pnote"),L=e.querySelector("#unit-switcher"),O=e.querySelector("#theme-toggle"),q=e.querySelector("#copy-link-btn"),j=e.querySelector("#copy-md-btn"),ne=e.querySelector("#print-btn");e.addEventListener("toggle",a=>{const d=a.target;if(d&&d.tagName==="DETAILS"&&d.classList.contains("trace")){const x=d.getAttribute("data-trace-id");x&&(d.open?u.add(x):u.delete(x))}},!0),O.addEventListener("click",()=>{n==="system"?(n="dark",document.documentElement.setAttribute("data-theme","dark"),O.textContent="Theme: Dark"):n==="dark"?(n="light",document.documentElement.setAttribute("data-theme","light"),O.textContent="Theme: Light"):(n="system",document.documentElement.removeAttribute("data-theme"),O.textContent="Theme: Auto")}),q.addEventListener("click",async()=>{ue(i);try{await navigator.clipboard.writeText(window.location.href),q.textContent="Link Copied!",setTimeout(()=>{q.textContent="Copy Link"},1800)}catch{q.textContent="URL in address bar"}}),j.addEventListener("click",async()=>{const a=Ne(i.input,i.unit,i.goalSeekTarget,i.goalSeekGrowth);try{await navigator.clipboard.writeText(a),j.textContent="Markdown Copied!",setTimeout(()=>{j.textContent="Copy Markdown"},1800)}catch{j.textContent="Copy failed"}}),ne.addEventListener("click",()=>{window.print()}),L.querySelectorAll("button[data-unit]").forEach(a=>{a.addEventListener("click",()=>{const d=a.dataset.unit;if(d===i.unit)return;const x=i.unit;i.unit=d,x==="INR_CR"&&d==="INR_LAKH"||x==="INR_LAKH"&&d==="INR_CR"?(i.input.ask=J(i.input.ask,x,d),i.input.annualRevenue=J(i.input.annualRevenue,x,d),i.input.priorRaise=J(i.input.priorRaise,x,d),i.input.cashNeeded=J(i.input.cashNeeded,x,d)):i.activePresetId=null,z(),U()})}),ee.forEach(a=>{const d=document.createElement("button");d.type="button",d.textContent=a.shortLabel,d.dataset.id=a.id,d.setAttribute("aria-pressed",i.activePresetId===a.id?"true":"false"),d.addEventListener("click",()=>{i.unit=a.unit,i.activePresetId=a.id,i.input={...a.input,verdictBands:{...i.input.verdictBands}},z(),U()}),_.appendChild(d)});function z(a){const{input:d}=i;if(a!==p&&(p.value=String(d.ask)),a!==f&&(f.value=String(d.dilutionPct)),a!==c&&(c.value=String(Number(d.annualRevenue.toFixed(4)))),a!==m){const x=d.annualRevenue/12;m.value=String(Number(x.toFixed(4)))}a!==g&&(g.value=String(d.priorRaise)),v.checked=d.priorRaiseWasPriced,a!==R&&(R.value=String(d.stepUpMultiple)),a!==A&&(A.value=String(d.nextRoundMultiple)),a!==w&&(w.value=String(d.monthsToNextRound)),a!==s&&(s.value=String(d.cashNeeded)),a!==N&&(N.value=String(d.esopTopUpPct)),a!==E&&(E.value=i.goalSeekTarget),a!==P&&(P.value=String(i.goalSeekGrowth)),a!==S&&(S.value=String(d.verdictBands.reachableMax)),a!==C&&(C.value=String(d.verdictBands.stretchMax))}function G(a){const d=a.value.trim();if(d==="")return 0;const x=Number(d);return Number.isFinite(x)?x:NaN}function h(a){if(a!==E&&a!==P&&a!==S&&a!==C&&(i.activePresetId=null),a===m){const d=G(m);i.input.annualRevenue=Number.isFinite(d)?Number((d*12).toFixed(6)):NaN,Number.isFinite(i.input.annualRevenue)&&(c.value=String(Number(i.input.annualRevenue.toFixed(4))))}else if(a===c){const d=G(c);i.input.annualRevenue=d,Number.isFinite(d)&&(m.value=String(Number((d/12).toFixed(4))))}else if(a===E)i.goalSeekTarget=E.value;else if(a===P){const d=G(P);Number.isFinite(d)&&d>0&&(i.goalSeekGrowth=d)}else a===S||a===C?(i.input.verdictBands.reachableMax=G(S),i.input.verdictBands.stretchMax=G(C)):(i.input.ask=G(p),i.input.dilutionPct=G(f),i.input.priorRaise=G(g),i.input.priorRaiseWasPriced=v.checked,i.input.stepUpMultiple=G(R),i.input.nextRoundMultiple=G(A),i.input.monthsToNextRound=G(w),i.input.cashNeeded=G(s),i.input.esopTopUpPct=G(N));U()}[p,f,m,c,g,R,A,w,s,N,P,S,C].forEach(a=>{a.addEventListener("input",()=>h(a))}),v.addEventListener("change",()=>h(v)),E.addEventListener("change",()=>h(E)),H.addEventListener("click",()=>{i.input.verdictBands={...D},i.goalSeekGrowth=D.reachableMax,z(),U()});function W(a){const d={ask:{input:p,errEl:e.querySelector("#err-ask")},dilutionPct:{input:f,errEl:e.querySelector("#err-dil")},annualRevenue:{input:c,errEl:e.querySelector("#err-rev")},priorRaise:{input:g,errEl:e.querySelector("#err-prior")},stepUpMultiple:{input:R,errEl:e.querySelector("#err-step")},nextRoundMultiple:{input:A,errEl:e.querySelector("#err-mult")},monthsToNextRound:{input:w,errEl:e.querySelector("#err-months")},cashNeeded:{input:s,errEl:e.querySelector("#err-cash")},esopTopUpPct:{input:N,errEl:e.querySelector("#err-esop")},esopAndDilution:{input:N,errEl:e.querySelector("#err-esop")},verdictBands:{input:C,errEl:e.querySelector("#err-bands")}};Object.values(d).forEach(x=>{x&&(x.input.removeAttribute("aria-invalid"),x.errEl.hidden=!0,x.errEl.textContent="")}),a.validation.errors.forEach(x=>{const T=d[x.field];T&&(T.input.setAttribute("aria-invalid","true"),T.errEl.hidden=!1,T.errEl.textContent=x.message)})}function U(){ue(i);const a=ie[i.unit];e.querySelector("#unit-banner-text").textContent=`All monetary amounts are in ${a.shortUnit}.`,e.querySelector("#unit-hint").textContent=`Amounts in ${a.shortUnit}`,e.querySelector("#ask-unit-sub").textContent=`${a.shortUnit} intended raise`,e.querySelector("#rev-sub").textContent=`${a.shortUnit} (monthly × 12)`,e.querySelector("#prior-sub").textContent=`${a.shortUnit} (0 if none)`,e.querySelector("#cash-sub").textContent=`${a.shortUnit} from your burn plan (0 if unset)`,L.querySelectorAll("button[data-unit]").forEach(k=>{k.setAttribute("aria-pressed",k.dataset.unit===i.unit?"true":"false")}),e.querySelector("#verdict-band-badge").textContent=`Verdict bands: ≤${l(i.input.verdictBands.reachableMax,1)} / ≤${l(i.input.verdictBands.stretchMax,1)} (our assumption)`;const d=e.querySelector("#mrr-sub");Number.isFinite(i.input.annualRevenue)&&i.input.annualRevenue>0?d.textContent=`${V(i.input.annualRevenue/12,i.unit)} (synced with annual ÷ 12)`:d.textContent=`${a.shortUnit}/mo (synced with annual ÷ 12)`,_.querySelectorAll("button").forEach(k=>{const Q=k.dataset.id===i.activePresetId;k.setAttribute("aria-pressed",Q?"true":"false")});const x=ee.find(k=>k.id===i.activePresetId);x?(Y.hidden=!1,Y.textContent=x.description):Y.hidden=!0;const T=ce(i.input,i.unit);W(T);const he=e.querySelector("#vdot"),ve=e.querySelector("#vh"),fe=e.querySelector("#vreasons");he.dataset.level=T.verdict.level,ve.textContent=T.verdict.headline,fe.innerHTML=T.verdict.reasons.map(k=>{const Q=k.isAssumption?"badge badge-assumption":"badge";return`
          <li class="reason-item" data-tone="${b(k.tone)}">
            <span>${b(k.text)}</span>
            <span class="${Q}">${b(k.origin)}</span>
          </li>
        `}).join("");const be=e.querySelector("#tiles"),{metrics:$}=T;be.innerHTML=[K($.impliedPostMoney,u),K($.impliedPostRevenueMultiple,u),K($.nextRoundPreMoney,u),K($.requiredNextAnnualRevenue,u),K($.requiredGrowthMultiple,u),K($.fundingGap,u)].join("");const ge=e.querySelector("#band-pills"),re=e.querySelector("#gs-output"),F=me(i.input,i.goalSeekTarget,i.goalSeekGrowth,i.unit),Z=[];T.validation.valid&&i.input.annualRevenue>0&&(Z.push(`
        <div class="band-pill" data-band="reachable">
          <span class="bl">Max Ask for Reachable (≤${b(l(i.input.verdictBands.reachableMax,1))})</span>
          <span class="bv">${b(r(T.feasibleAskBand.reachableAsk,i.unit))}</span>
        </div>
      `),Z.push(`
        <div class="band-pill" data-band="stretch">
          <span class="bl">Max Ask for Stretch (≤${b(l(i.input.verdictBands.stretchMax,1))})</span>
          <span class="bv">${b(r(T.feasibleAskBand.stretchAsk,i.unit))}</span>
        </div>
      `)),T.feasibleAskBand.priorRaiseBand&&Z.push(`
        <div class="band-pill" data-band="prior">
          <span class="bl">3–4x Priced Prior Raise Band</span>
          <span class="bv">${b(r(T.feasibleAskBand.priorRaiseBand[0],i.unit))} – ${b(r(T.feasibleAskBand.priorRaiseBand[1],i.unit))}</span>
        </div>
      `),ge.innerHTML=Z.join("");const ye=F.isFeasible&&F.solvedValue!==null;re.innerHTML=`
      <div class="solver-result-row">
        <div class="solver-hero">
          <span class="sv">${b(F.formattedSolvedValue)}</span>
          ${F.secondaryFormattedValue?`<span class="ss">(${b(F.secondaryFormattedValue)})</span>`:""}
        </div>
        ${ye?'<button type="button" id="apply-goalseek-btn" class="btn-primary">Apply to inputs</button>':""}
      </div>
      <p style="margin: 0; font-size: 13.5px; color: var(--ink);">${b(F.summary)}</p>
      ${F.formula?X("goalseek_trace",F.formula,F.calculation,!0,`Backwards goal-seek at ≤${l(F.targetGrowthMultiple,1)} target growth`,u):""}
    `;const se=re.querySelector("#apply-goalseek-btn");se&&F.solvedValue!==null&&se.addEventListener("click",()=>{i.activePresetId=null;const k=Number(F.solvedValue.toFixed(2));i.goalSeekTarget==="max_ask"?i.input.ask=k:i.goalSeekTarget==="required_revenue"?i.input.annualRevenue=k:i.goalSeekTarget==="required_dilution"&&(i.input.dilutionPct=Number(F.solvedValue.toFixed(1))),z(),U()});const Me=e.querySelector("#chain"),te=[{id:"chain_ask",label:"Ask (intended raise)",value:r(i.input.ask,i.unit),formula:"Direct user input (Ask)",calculation:`Ask = ${r(i.input.ask,i.unit)} at ${M(i.input.dilutionPct,1)} target dilution`,isAssumption:!1,origin:"User Input"},{id:"chain_pre",label:"Pre-money signalled",value:$.impliedPreMoney.formattedValue,formula:$.impliedPreMoney.formula,calculation:$.impliedPreMoney.calculation,isAssumption:$.impliedPreMoney.isAssumption,origin:$.impliedPreMoney.assumptionOrigin},{id:"chain_pre_mult",label:"Implied revenue multiple (pre vs. post)",value:$.impliedPreRevenueMultiple.value!==null&&$.impliedPostRevenueMultiple.value!==null?`${l($.impliedPreRevenueMultiple.value,1)} pre · ${l($.impliedPostRevenueMultiple.value,1)} post`:"Enter revenue",formula:$.impliedPreRevenueMultiple.formula,calculation:$.impliedPostRevenueMultiple.calculation,isAssumption:!1,origin:"Source Article (Example B notes ~7x pre-money on ₹80 Cr / ₹12 Cr ARR)"}];i.input.esopTopUpPct>0&&te.push({id:"chain_esop",label:`Effective pre-money after ${M(i.input.esopTopUpPct,1)} ESOP pool`,value:$.effectivePreMoneyAfterEsop.formattedValue,formula:$.effectivePreMoneyAfterEsop.formula,calculation:$.effectivePreMoneyAfterEsop.calculation,isAssumption:$.effectivePreMoneyAfterEsop.isAssumption,origin:$.effectivePreMoneyAfterEsop.assumptionOrigin}),i.input.priorRaise>0&&te.push({id:"chain_prior",label:"Ask vs. previous raise",value:$.askToPriorRaiseMultiple.formattedValue,formula:$.askToPriorRaiseMultiple.formula,calculation:$.askToPriorRaiseMultiple.calculation,isAssumption:!i.input.priorRaiseWasPriced,origin:i.input.priorRaiseWasPriced?"Source Article (3–4x previous priced raise benchmark)":"Our Assumption (Unpriced prior raise bypasses 3–4x rule)"}),Me.innerHTML=te.map(k=>`
        <li>
          <div class="chain-row">
            <span class="chain-label">${b(k.label)}</span>
            <span class="chain-value">${b(k.value)}</span>
          </div>
          ${X(k.id,k.formula,k.calculation,k.isAssumption,k.origin,u)}
        </li>
      `).join("");const ae=e.querySelector("#sens"),le=e.querySelector("#sens-trace-wrap");if(T.sensitivity.length===0)ae.innerHTML="",le.innerHTML="";else{const k=`
        <thead>
          <tr>
            <th>Dilution</th>
            <th>Post-money</th>
            <th>Pre-money</th>
            <th>Pre / Post ×</th>
            <th>Next pre</th>
            <th>Growth</th>
          </tr>
        </thead>
      `,Q=T.sensitivity.map(I=>{const xe=I.isUserSelected?' class="active-row"':"",Re=I.isUserSelected?`${M(I.dilutionPct,1)} (yours)`:M(I.dilutionPct,1),Pe=I.impliedPreMultiple!==null&&I.impliedPostMultiple!==null?`${l(I.impliedPreMultiple,1)} / ${l(I.impliedPostMultiple,1)}`:"—",$e=I.requiredGrowthMultiple!==null?l(I.requiredGrowthMultiple,1):"—";return`
            <tr${xe}>
              <td title="${b(I.note)}">${b(Re)}</td>
              <td>${b(r(I.postMoney,i.unit))}</td>
              <td>${b(r(I.preMoney,i.unit))}</td>
              <td>${b(Pe)}</td>
              <td>${b(r(I.nextPreMoney,i.unit))}</td>
              <td>${b($e)}</td>
            </tr>
          `}).join("");ae.innerHTML=`${k}<tbody>${Q}</tbody>`,le.innerHTML=X("sens_table_trace","For each dilution d%: Post = Ask ÷ (d/100); Next Pre = Post × Step-Up; Growth = (Next Pre ÷ Next Multiple) ÷ Current ARR",`Evaluated at 20% (5x ask), 25% (4x ask), and 33% (~3x ask) benchmarks from the article${T.sensitivity.length>3?`, plus your custom ${M(i.input.dilutionPct,1)} input`:""}.`,!1,"Source Article (20%, 25%, 33% dilution benchmarks)",u)}}z(),U()}const de=document.getElementById("app");if(de){const e=Se();Ce(de,e)}
