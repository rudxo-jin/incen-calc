
import { calculateIncentive } from './utils/calculator';

const testData = {
    name: '서인영',
    position: '팀장',
    category: '택시',
    netSales: 58691900,
    profitMargin: 37.6
};

const result = calculateIncentive(testData);

console.log('--- Verification for 서인영 ---');
console.log(`Name: ${testData.name}`);
console.log(`Position: ${testData.position}`);
console.log(`Net Sales: ${testData.netSales.toLocaleString()}`);
console.log(`Profit Margin: ${testData.profitMargin}%`);
console.log(`Category: ${testData.category}`);
console.log('-------------------------------');
console.log(`Base Deductible: ${result.baseDeductible.toLocaleString()}`);
console.log(`Level: ${result.level} (Rate: ${result.rate * 100}%)`);
console.log(`Multiplier: ${result.multiplier * 100}%`);
console.log(`Calculated Incentive: ${result.incentive.toLocaleString()} KRW`);
console.log('-------------------------------');
