
import * as XLSX from 'xlsx';

const data = [
    ['작업자명', '직급', '인센적용', '순매출액', '할인금액_부품액', '공임액', '공임액_할인포함', '매출이익_할인포함', '부품이익', '매익율', '부품이익율공임율'],
    ['서인영', '팀장', '택시', 58691900, 40000, 15475200, 15435200, 22034564, 6599364, '37.6%', '11.2%'],
    ['양성승', '선임기사', '택시', 58454200, 378200, 15158800, 14780600, 22289681, 7509081, '38.5%', '12.8%'],
    ['김테스트', '기사', '빵빵', 20000000, 0, 0, 0, 0, 0, '30.0%', '0%'] // Below threshold
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, 'sample.xlsx');
console.log('sample.xlsx created');
