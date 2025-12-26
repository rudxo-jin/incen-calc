
import { calculateIncentive } from './utils/calculator';

const testData = {
    name: '양성승',
    position: '선임기사',
    category: '택시',
    netSales: 58454200,
    profitMargin: 38.5
};

const result = calculateIncentive(testData);

console.log('--- Verification for 양성승 (선임기사) ---');
console.log(`Name: ${testData.name}`);
console.log(`Position: ${testData.position}`);
console.log(`Net Sales: ${testData.netSales.toLocaleString()}`);
console.log(`Profit Margin: ${testData.profitMargin}%`);
console.log(`Category: ${testData.category}`);
console.log('-------------------------------');
console.log(`Base Deductible: ${result.baseDeductible.toLocaleString()}`);
console.log(`Max Level Reached: ${result.level}`);
console.log(`Multiplier: ${result.multiplier * 100}%`);
console.log(`Calculated Incentive: ${result.incentive.toLocaleString()} KRW`);
console.log('-------------------------------');
