import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { X, Save, Plus, Trash2 } from 'lucide-react';

interface SalaryComponent {
    id: number;
    name: string;
    type: 'allowance' | 'deduction';
    is_fixed: boolean;
    default_amount: number;
}

interface SalarySetting {
    id?: number;
    employee_id: number;
    component_id: number;
    amount: number;
    salary_components?: SalaryComponent; // Joined data
}

interface Props {
    employeeId: number;
    employeeName: string;
    onClose: () => void;
}

export function SalarySettingsModal({ employeeId, employeeName, onClose }: Props) {
    const queryClient = useQueryClient();
    const [localSettings, setLocalSettings] = useState<SalarySetting[]>([]);

    // Fetch all available components
    const { data: components } = useQuery({
        queryKey: ['salary_components'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('salary_components')
                .select('*')
                .order('type')
                .order('id');
            if (error) throw error;
            return data as SalaryComponent[];
        }
    });

    // Fetch employee's current settings
    const { data: settings, isLoading } = useQuery({
        queryKey: ['employee_salary_settings', employeeId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employee_salary_settings')
                .select('*, salary_components(*)')
                .eq('employee_id', employeeId);
            if (error) throw error;
            return data as SalarySetting[];
        }
    });

    // Initialize local state when data loads
    useEffect(() => {
        if (settings && components) {
            // Merge existing settings with all available components to ensure we show everything
            // or at least show what's configured. 
            // Strategy: Show all "Fixed" components.
            const merged: SalarySetting[] = components
                .filter(c => c.is_fixed) // Only show fixed components for configuration
                .map(c => {
                    const existing = settings.find(s => s.component_id === c.id);
                    return {
                        employee_id: employeeId,
                        component_id: c.id,
                        amount: existing ? existing.amount : c.default_amount,
                        salary_components: c,
                        id: existing?.id
                    };
                });
            setLocalSettings(merged);
        }
    }, [settings, components, employeeId]);

    const saveMutation = useMutation({
        mutationFn: async (newSettings: SalarySetting[]) => {
            // Upsert all settings
            const upsertData = newSettings.map(s => ({
                employee_id: s.employee_id,
                component_id: s.component_id,
                amount: s.amount
            }));

            const { error } = await supabase
                .from('employee_salary_settings')
                .upsert(upsertData, { onConflict: 'employee_id, component_id' });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employee_salary_settings'] });
            queryClient.invalidateQueries({ queryKey: ['employees'] }); // To update base salary display if needed
            alert('저장되었습니다.');
            onClose();
        },
        onError: (err) => {
            console.error(err);
            alert('저장 실패');
        }
    });

    const handleSave = () => {
        saveMutation.mutate(localSettings);
    };

    const handleChange = (componentId: number, amount: number) => {
        setLocalSettings(prev => prev.map(p =>
            p.component_id === componentId ? { ...p, amount } : p
        ));
    };

    if (isLoading) return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-4 rounded">Loading...</div></div>;

    const allowances = localSettings.filter(s => s.salary_components?.type === 'allowance');
    const deductions = localSettings.filter(s => s.salary_components?.type === 'deduction');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-900">{employeeName} 급여 설정</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Allowances */}
                    <div>
                        <h3 className="text-lg font-semibold text-blue-600 mb-4 flex items-center">
                            <Plus size={20} className="mr-2" /> 지급 항목 (고정)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allowances.map(item => (
                                <div key={item.component_id} className="flex flex-col">
                                    <label className="text-sm font-medium text-gray-700 mb-1">
                                        {item.salary_components?.name}
                                    </label>
                                    <input
                                        type="number"
                                        value={item.amount}
                                        onChange={(e) => handleChange(item.component_id, Number(e.target.value))}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Deductions */}
                    <div>
                        <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center">
                            <Trash2 size={20} className="mr-2" /> 공제 항목 (고정)
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            * 4대보험/세금은 요율에 따라 자동 계산되도록 추후 업데이트 예정입니다. 현재는 고정 공제액을 입력하세요.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {deductions.map(item => (
                                <div key={item.component_id} className="flex flex-col">
                                    <label className="text-sm font-medium text-gray-700 mb-1">
                                        {item.salary_components?.name}
                                    </label>
                                    <input
                                        type="number"
                                        value={item.amount}
                                        onChange={(e) => handleChange(item.component_id, Number(e.target.value))}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-right"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                        <Save size={18} className="mr-2" />
                        저장하기
                    </button>
                </div>
            </div>
        </div>
    );
}
