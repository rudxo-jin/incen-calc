import React, { useCallback } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { IncentiveData } from '../utils/calculator';

interface FileUploadProps {
    onDataLoaded: (data: IncentiveData[]) => void;
}

export function FileUpload({ onDataLoaded }: FileUploadProps) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        console.log('File selected:', file);
        if (!file) return;

        setIsLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                console.log('Raw Excel Data (first 5 rows):', data.slice(0, 5));

                if (data.length === 0) {
                    throw new Error('엑셀 파일에 데이터가 없습니다.');
                }

                // Parse data
                const headers = data[0] as string[];
                console.log('Detected Headers:', headers);

                // Basic validation of headers
                const requiredHeaders = ['작업자명', '직급', '순매출액', '매익율'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

                if (missingHeaders.length > 0) {
                    console.warn('Missing headers:', missingHeaders);
                }

                const rows = data.slice(1) as any[];

                const parsedData: IncentiveData[] = rows.map((row, idx) => {
                    const nameIdx = headers.indexOf('작업자명');
                    const posIdx = headers.indexOf('직급');
                    const catIdx = headers.indexOf('인센적용');
                    const salesIdx = headers.indexOf('순매출액');
                    const marginIdx = headers.indexOf('매익율');

                    const item = {
                        name: row[nameIdx !== -1 ? nameIdx : 0],
                        position: row[posIdx !== -1 ? posIdx : 1],
                        category: row[catIdx !== -1 ? catIdx : 2],
                        netSales: Number(row[salesIdx !== -1 ? salesIdx : 3]) || 0,
                        profitMargin: typeof row[marginIdx !== -1 ? marginIdx : 10] === 'string'
                            ? parseFloat(row[marginIdx !== -1 ? marginIdx : 10].replace('%', ''))
                            : (Number(row[marginIdx !== -1 ? marginIdx : 10]) * 100 || 0),
                    };

                    if (idx < 3) console.log(`Row ${idx} parsed:`, item);
                    return item;
                }).filter(item => item.name);

                console.log('Parsed Data Count:', parsedData.length);

                if (parsedData.length === 0) {
                    throw new Error('유효한 데이터가 없습니다. 헤더 명칭(작업자명, 직급, 인센적용, 순매출액, 매익율)을 확인해주세요.');
                }

                const normalizedData = parsedData.map(d => {
                    let margin = d.profitMargin;
                    if (margin <= 1 && margin > 0) {
                        margin = margin * 100;
                    }
                    return { ...d, profitMargin: parseFloat(margin.toFixed(1)) };
                });

                onDataLoaded(normalizedData);
            } catch (error: any) {
                console.error('Error parsing Excel:', error);
                setError(error.message || '파일을 읽는 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    }, [onDataLoaded]);

    return (
        <div className="w-full max-w-xl mx-auto">
            <div className={`p-8 border-2 border-dashed rounded-xl transition-colors text-center ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-blue-500 bg-gray-50'}`}>
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-4">
                    <div className={`p-4 rounded-full ${error ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <FileSpreadsheet size={48} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {isLoading ? '파일 분석 중...' : '엑셀 파일 업로드'}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {error ? <span className="text-red-600 font-medium">{error}</span> : '.xlsx 또는 .xls 파일을 드래그하거나 클릭하여 선택하세요'}
                        </p>
                    </div>
                    <input
                        id="file-upload"
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isLoading}
                    />
                </label>
            </div>
        </div>
    );
}
