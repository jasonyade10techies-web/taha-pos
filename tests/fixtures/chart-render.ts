import {createElement} from 'react';
import {createRoot} from 'react-dom/client';

export async function renderZeroChart(sales=0){
 const component='/src/components/dashboard/sales-chart.tsx';
 const {SalesChart}=await import(/* @vite-ignore */ component);
 const target=document.createElement('section');target.id='axis-regression';document.body.append(target);
 createRoot(target).render(createElement(SalesChart,{data:[{day:'Today',date:'2026-10-17',sales,profit:0}]}));
}
