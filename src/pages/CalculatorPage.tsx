import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FileUpload } from '../components/FileUpload';
import { IncentiveTable } from '../components/IncentiveTable';
import { calculateIncentive, type IncentiveData, DEFAULT_THRESHOLDS } from '../utils/calculator';
import { Save, RotateCcw } from 'lucide-react';

export function CalculatorPage() {
    const queryClient = useQueryClient();
    const [data, setData] = useState<IncentiveData[]>([]);

    // Date Selection State
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);

    // Fetch Settings
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .single();
            if (error) throw error;
            return data;
        }
    });

    // Fetch Employees
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employees')
                .select('*');
            if (error) throw error;
            return data;
        }
    });

    const handleUpdateRow = (index: number, field: keyof IncentiveData, value: any) => {
        const newData = [...data];
        newData[index] = { ...newData[index], [field]: value };
        setData(newData);
    };

    const handleDeleteRow = (index: number) => {
        if (confirm('이 행을 삭제하시겠습니까?')) {
            const newData = data.filter((_, i) => i !== index);
            setData(newData);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (data.length === 0) return;

            // 1. Check for existing record
            const { data: existing } = await supabase
                .from('monthly_records')
                .select('id')
                .eq('year', year)
                .eq('month', month)
                .single();

            if (existing) {
                if (!confirm(`${year}년 ${month}월 데이터가 이미 존재합니다. 덮어쓰시겠습니까?`)) {
                    return; // Cancelled by user
                }
                // Delete existing (Cascade will delete details)
                const { error: deleteError } = await supabase
                    .from('monthly_records')
                    .delete()
                    .eq('id', existing.id);
                if (deleteError) throw deleteError;
            }

            // 2. Prepare Data
            let totalRevenue = 0;
            let totalIncentive = 0;
            let totalProfit = 0;

            const details = data.map(row => {
                const employee = employees?.find(e => e.name === row.name);
                // Use settings thresholds or default
                const thresholds = settings?.thresholds && Object.keys(settings.thresholds).length > 0
                    ? settings.thresholds
                    : DEFAULT_THRESHOLDS;

                const result = calculateIncentive(row, employee ? {
                    type: employee.type,
                    baseSalary: employee.base_salary
                } : undefined, thresholds);

                totalRevenue += row.netSales;
                totalIncentive += result.incentive;
                totalProfit += row.netSales * (row.profitMargin / 100);

                return {
                    employee_name: row.name,
                    position: row.position,
                    store_name: employee?.store_name || '미지정',
                    net_sales: row.netSales,
                    profit_margin: row.profitMargin,
                    incentive_amount: result.incentive,
                    level: result.level,
                    multiplier: result.multiplier
                };
            });

            // 3. Insert Monthly Record
            const { data: newRecord, error: recordError } = await supabase
                .from('monthly_records')
                .insert({
                    year,
                    month,
                    total_revenue: totalRevenue,
                    total_incentive: totalIncentive,
                    total_profit: Math.round(totalProfit),
                    employee_count: data.length
                })
                .select()
                .single();

            if (recordError) throw recordError;

            // 4. Insert Details
            const { error: detailsError } = await supabase
                .from('incentive_details')
                .insert(details.map(d => ({ ...d, record_id: newRecord.id })));

            if (detailsError) throw detailsError;
        },
        onSuccess: () => {
            alert('저장되었습니다.');
            setData([]);
            queryClient.invalidateQueries({ queryKey: ['history'] }); // Invalidate history if we have it
        },
        onError: (error) => {
            console.error('Save failed:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    });

    const handleSave = () => {
        saveMutation.mutate();
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">인센티브 계산 (Cloud)</h2>

                {data.length > 0 && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="bg-transparent outline-none font-medium text-gray-700"
                            >
                                {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y}>{y}년</option>
                                ))}
                            </select>
                            <span className="text-gray-400">|</span>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className="bg-transparent outline-none font-medium text-gray-700"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{m}월</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saveMutation.isPending}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            <Save size={18} />
                            {saveMutation.isPending ? '저장 중...' : '저장하기'}
                        </button>

                        <button
                            onClick={() => setData([])}
                            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                            <RotateCcw size={18} />
                            초기화
                        </button>
                    </div>
                )}
            </div>

            {data.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200">
                    <FileUpload onDataLoaded={setData} />
                    <div className="mt-8 text-center text-sm text-gray-500">
                        <p>지원 형식: .xlsx, .xls</p>
                        <p>필수 컬럼: 작업자명, 직급, 인센적용, 순매출액, 매익율</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 flex items-start gap-2">
                        <span className="mt-0.5">ℹ️</span>
                        <div>
                            <p className="font-medium">미리보기 및 편집 모드</p>
                            <p>데이터를 확인하고 필요한 경우 내용을 직접 수정하거나 삭제할 수 있습니다. 완료되면 '저장하기'를 눌러주세요.</p>
                        </div>
                    </div>

                    <IncentiveTable
                        data={data}
                        thresholds={settings?.thresholds}
                        isEditable={true}
                        onUpdateRow={handleUpdateRow}
                        onDeleteRow={handleDeleteRow}
                    />
                </div>
            )}
        </div>
    );
}
