import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { X, Save, User, DollarSign, Calendar, Briefcase, Building, Calculator } from 'lucide-react';

interface Employee {
    id: number;
    name: string;
    position: string;
    store_name: string;
    type: 'incentive' | 'basic';
    base_salary: number;
    hire_date: string;
    is_active: boolean;
    resignation_date?: string;
    work_type_id?: number;
    incentive_category?: string;
    dependents_count?: number;
}

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
    salary_components?: SalaryComponent;
}

interface WorkType {
    id: number;
    name: string;
    days_per_week: number;
    basic_daily_hours: number;
    overtime_daily_hours: number;
    overtime_days_per_week: number;
    holiday_work_daily_hours: number;
    holiday_work_days_per_week: number;
}

interface Props {
    employeeId: number | null;
    onClose: () => void;
}

export function EmployeeDetailModal({ employeeId, onClose }: Props) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'basic' | 'salary'>('basic');
    const [jobGroup, setJobGroup] = useState<string>('현장직');

    // --- Basic Info State ---
    const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({});

    // --- Salary Settings State ---
    const [salarySettings, setSalarySettings] = useState<SalarySetting[]>([]);

    // --- Calculator State ---
    const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<number | null>(null);
    const [contractAmount, setContractAmount] = useState<number>(0);

    // --- Fetch Data ---
    const { data: employee, isLoading: isEmployeeLoading } = useQuery({
        queryKey: ['employee', employeeId],
        queryFn: async () => {
            if (!employeeId) return null;
            const { data, error } = await supabase.from('employees').select('*').eq('id', employeeId).single();
            if (error) throw error;
            return data as Employee;
        },
        enabled: !!employeeId
    });

    const { data: components } = useQuery({
        queryKey: ['salary_components'],
        queryFn: async () => {
            const { data, error } = await supabase.from('salary_components').select('*').order('type').order('id');
            if (error) throw error;
            return data as SalaryComponent[];
        }
    });

    const { data: currentSettings } = useQuery({
        queryKey: ['employee_salary_settings', employeeId],
        queryFn: async () => {
            if (!employeeId) return [];
            const { data, error } = await supabase
                .from('employee_salary_settings')
                .select('*, salary_components(*)')
                .eq('employee_id', employeeId);
            if (error) throw error;
            return data as SalarySetting[];
        },
        enabled: !!employeeId
    });

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase.from('settings').select('*').single();
            if (error) throw error;
            return data;
        }
    });
    const stores: string[] = settings?.stores ? (typeof settings.stores === 'string' ? JSON.parse(settings.stores) : settings.stores) : [];
    const incentiveCategories: string[] = settings?.incentive_categories ? (typeof settings.incentive_categories === 'string' ? JSON.parse(settings.incentive_categories) : settings.incentive_categories) : ['택시', '빵빵', '미적용'];
    const positions: Record<string, string[]> = settings?.positions || {
        "현장직": ["수습", "사원", "선임기사", "팀장", "공장장"],
        "사무직": ["사원", "실장", "주임", "대리", "과장", "차장", "부장", "이사", "대표이사"]
    };

    const { data: workTypes } = useQuery({
        queryKey: ['work_types'],
        queryFn: async () => {
            const { data, error } = await supabase.from('work_types').select('*').order('id');
            if (error) throw error;
            return data as WorkType[];
        }
    });


    // --- Initialize State ---
    useEffect(() => {
        if (employee) {
            setEmployeeForm({
                ...employee,
                incentive_category: employee.incentive_category || '택시'
            });
            // Initialize calculator state if available
            if (employee.work_type_id) setSelectedWorkTypeId(employee.work_type_id);
            if (employee.base_salary) setContractAmount(employee.base_salary);

            // Find job group
            let group = '현장직';
            if (settings?.positions) {
                for (const [key, list] of Object.entries(settings.positions as Record<string, string[]>)) {
                    if (list.includes(employee.position)) {
                        group = key;
                        break;
                    }
                }
            }
            setJobGroup(group);
        } else if (!employeeId) {
            // Default values for new employee
            setEmployeeForm({
                position: '기사',
                incentive_category: '택시',
                is_active: true,
                type: 'incentive',
                hire_date: new Date().toISOString().split('T')[0],
                dependents_count: 1
            });
        }
    }, [employee, employeeId, settings]);

    useEffect(() => {
        if (components) {
            if (currentSettings) {
                // Edit mode: merge existing settings
                const merged: SalarySetting[] = components
                    .filter(c => c.is_fixed || c.name === '국민연금')
                    .map(c => {
                        const existing = currentSettings.find(s => s.component_id === c.id);
                        return {
                            employee_id: employeeId!,
                            component_id: c.id,
                            amount: existing ? existing.amount : c.default_amount,
                            salary_components: c,
                            id: existing?.id
                        };
                    });
                setSalarySettings(merged);
            } else if (!employeeId) {
                // Create mode: use default amounts
                const defaults: SalarySetting[] = components
                    .filter(c => c.is_fixed || c.name === '국민연금')
                    .map(c => ({
                        employee_id: 0, // Placeholder
                        component_id: c.id,
                        amount: c.default_amount,
                        salary_components: c
                    }));
                setSalarySettings(defaults);
            }
        }
    }, [currentSettings, components, employeeId]);


    // --- Mutations ---
    const updateEmployeeMutation = useMutation({
        mutationFn: async (updates: Partial<Employee>) => {
            const { error } = await supabase.from('employees').update(updates).eq('id', employeeId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            if (employeeId) queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
        }
    });

    const insertEmployeeMutation = useMutation({
        mutationFn: async (newEmployee: Partial<Employee>) => {
            const { data, error } = await supabase.from('employees').insert([{ ...newEmployee, base_salary: 0 }]).select().single();
            if (error) throw error;
            return data as Employee;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        }
    });

    const updateSalaryMutation = useMutation({
        mutationFn: async ({ settings, targetEmployeeId }: { settings: SalarySetting[], targetEmployeeId: number }) => {
            // 1. Update Salary Components
            const upsertData = settings.map(s => ({
                employee_id: targetEmployeeId,
                component_id: s.component_id,
                amount: s.amount
            }));
            const { error: settingsError } = await supabase.from('employee_salary_settings').upsert(upsertData, { onConflict: 'employee_id, component_id' });
            if (settingsError) throw settingsError;

            // 2. Update Employee Work Type & Contract Amount (Base Salary)
            if (selectedWorkTypeId || contractAmount) {
                const { error: employeeError } = await supabase
                    .from('employees')
                    .update({
                        work_type_id: selectedWorkTypeId || null,
                        base_salary: contractAmount
                    })
                    .eq('id', targetEmployeeId);
                if (employeeError) throw employeeError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employee_salary_settings'] });
            queryClient.invalidateQueries({ queryKey: ['employees'] }); // Refresh list
        }
    });

    const handleSaveAll = async () => {
        try {
            // 1. Save Basic Info
            const basicUpdates = { ...employeeForm };
            if (basicUpdates.resignation_date) {
                basicUpdates.is_active = false;
            }

            let targetId = employeeId;

            if (!targetId) {
                // Create new employee
                const newEmployee = await insertEmployeeMutation.mutateAsync(basicUpdates);
                targetId = newEmployee.id;
            } else {
                // Update existing employee
                await updateEmployeeMutation.mutateAsync(basicUpdates);
            }

            // 2. Save Salary Settings
            // Update employee_id in settings for new employee
            const settingsToSave = salarySettings.map(s => ({
                ...s,
                employee_id: targetId!
            }));

            await updateSalaryMutation.mutateAsync({
                settings: settingsToSave,
                targetEmployeeId: targetId!
            });

            alert('저장되었습니다.');
            onClose();
        } catch (error: any) {
            console.error('Save failed:', error);
            alert(`저장 실패: ${error.message || '알 수 없는 오류'}`);
        }
    };

    const handleSalaryChange = (componentId: number, amount: number) => {
        setSalarySettings(prev => prev.map(p =>
            p.component_id === componentId ? { ...p, amount } : p
        ));
    };

    // --- Calculator Logic ---
    const handleCalculateSalary = () => {
        if (!selectedWorkTypeId || !contractAmount || !workTypes || !components) return;

        const workType = workTypes.find(wt => wt.id === selectedWorkTypeId);
        if (!workType) return;

        // 1. Identify Component IDs
        const findCompId = (name: string) => components.find(c => c.name === name)?.id;
        const basicId = findCompId('기본급');
        const overtimeId = findCompId('연장근로수당') || findCompId('시간외근로수당');
        const weeklyId = findCompId('주휴수당');
        const holidayId = findCompId('휴일근로수당') || findCompId('기본휴일수당');

        // 2. Calculate Target Amount for Auto-Calculation
        // Subtract other fixed allowances (e.g., Job Allowance) from the Total Contract Amount
        const otherAllowancesTotal = salarySettings
            .filter(s =>
                s.salary_components?.type === 'allowance' &&
                ![basicId, overtimeId, weeklyId, holidayId].includes(s.component_id)
            )
            .reduce((sum, s) => sum + (s.amount || 0), 0);

        const targetForCalculation = contractAmount - otherAllowancesTotal;

        if (targetForCalculation < 0) {
            alert('오류: 기타 수당의 합계가 총 급여보다 큽니다.');
            return;
        }

        const WEEKS_CONST = 4.34;

        // Precise calculation without intermediate rounding
        const basicMonthlyHours = (workType.basic_daily_hours * workType.days_per_week / 5 * 5) * WEEKS_CONST;
        const overtimeMonthlyHours = (workType.overtime_daily_hours * workType.overtime_days_per_week) * WEEKS_CONST * 1.5;
        const weeklyHolidayMonthlyHours = workType.basic_daily_hours * WEEKS_CONST;
        const holidayWorkMonthlyHours = (workType.holiday_work_daily_hours * workType.holiday_work_days_per_week) * WEEKS_CONST * 1.5;

        const totalCalculationHours = basicMonthlyHours + overtimeMonthlyHours + weeklyHolidayMonthlyHours + holidayWorkMonthlyHours;

        if (totalCalculationHours === 0) return;

        const hourlyRate = targetForCalculation / totalCalculationHours;

        // 3. Calculate Amounts (Rounded to 1 won)
        let basicSalary = Math.round(basicMonthlyHours * hourlyRate);
        let overtimeAllowance = Math.round(overtimeMonthlyHours * hourlyRate);
        let weeklyHolidayAllowance = Math.round(weeklyHolidayMonthlyHours * hourlyRate);
        let holidayWorkAllowance = Math.round(holidayWorkMonthlyHours * hourlyRate);

        // Adjust for rounding errors to match target amount
        const currentTotal = basicSalary + overtimeAllowance + weeklyHolidayAllowance + holidayWorkAllowance;
        const difference = targetForCalculation - currentTotal;

        if (difference !== 0) {
            if (holidayWorkAllowance > 0) {
                holidayWorkAllowance += difference;
            } else {
                basicSalary += difference;
            }
        }

        // 4. Prepare Updates
        const updates: Record<number, number> = {};
        if (basicId) updates[basicId] = basicSalary;
        if (overtimeId) updates[overtimeId] = overtimeAllowance;
        if (weeklyId) updates[weeklyId] = weeklyHolidayAllowance;
        if (holidayId) updates[holidayId] = holidayWorkAllowance;

        // 5. Update State
        setSalarySettings(prev => prev.map(p =>
            updates[p.component_id] !== undefined ? { ...p, amount: updates[p.component_id] } : p
        ));

        alert(`계산 완료!\n시급: ${Math.round(hourlyRate).toLocaleString()}원\n총 산정시간: ${totalCalculationHours.toFixed(2)}시간\n(기타 수당 ${otherAllowancesTotal.toLocaleString()}원 제외 후 계산됨)`);
    };


    if (isEmployeeLoading) return null;
    if (employeeId && !employee) return null;

    const allowances = salarySettings.filter(s => s.salary_components?.type === 'allowance');
    const deductions = salarySettings.filter(s => s.salary_components?.type === 'deduction');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-gray-50">
                    <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                            {employee ? employee.name[0] : <User size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{employee ? employee.name : '신규 직원 추가'}</h2>
                            <p className="text-sm text-gray-500">
                                {employee ? `${employee.position} | ${employee.store_name}` : '새로운 직원의 정보를 입력하세요'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={28} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('basic')}
                        className={`flex-1 py-4 text-center font-medium transition-colors ${activeTab === 'basic' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <User size={18} className="inline-block mr-2 mb-1" /> 기본 정보
                    </button>
                    <button
                        onClick={() => setActiveTab('salary')}
                        className={`flex-1 py-4 text-center font-medium transition-colors ${activeTab === 'salary' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <DollarSign size={18} className="inline-block mr-2 mb-1" /> 급여 설정
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    {activeTab === 'basic' && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={employeeForm.name || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">직군</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <select
                                            value={jobGroup}
                                            onChange={e => {
                                                setJobGroup(e.target.value);
                                                // Reset position when group changes
                                                const firstPosition = positions[e.target.value]?.[0] || '';
                                                setEmployeeForm({ ...employeeForm, position: firstPosition });
                                            }}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                                        >
                                            {Object.keys(positions).map(group => (
                                                <option key={group} value={group}>{group}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">직급</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <select
                                            value={employeeForm.position || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                                        >
                                            {positions[jobGroup]?.map(pos => (
                                                <option key={pos} value={pos}>{pos}</option>
                                            ))}
                                            {!positions[jobGroup] && <option value="">직급 없음</option>}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            list="store-list-modal"
                                            value={employeeForm.store_name || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, store_name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">인센티브 구분</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <select
                                            value={employeeForm.incentive_category || '택시'}
                                            onChange={e => setEmployeeForm({ ...employeeForm, incentive_category: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                                        >
                                            {incentiveCategories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">입사일</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="date"
                                            value={employeeForm.hire_date || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">퇴사일</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="date"
                                            value={employeeForm.resignation_date || ''}
                                            onChange={e => setEmployeeForm({ ...employeeForm, resignation_date: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">부양가족수 (본인 포함)</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="number"
                                            min="1"
                                            value={employeeForm.dependents_count || 1}
                                            onChange={e => setEmployeeForm({ ...employeeForm, dependents_count: parseInt(e.target.value) || 1 })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                    )}

                    {activeTab === 'salary' && (
                        <div className="space-y-8 max-w-3xl mx-auto">
                            {/* Calculator Section */}
                            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                                <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center">
                                    <Calculator size={20} className="mr-2" />
                                    급여 자동 계산기
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">근무 형태 선택</label>
                                        <select
                                            value={selectedWorkTypeId || ''}
                                            onChange={e => setSelectedWorkTypeId(Number(e.target.value))}
                                            className="w-full p-2 border rounded-lg text-sm bg-white"
                                        >
                                            <option value="">선택하세요</option>
                                            {workTypes?.map(wt => (
                                                <option key={wt.id} value={wt.id}>{wt.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">총 급여 (계약금액)</label>
                                        <input
                                            type="number"
                                            value={contractAmount}
                                            onChange={e => setContractAmount(Number(e.target.value))}
                                            className="w-full p-2 border rounded-lg text-sm text-right"
                                            placeholder="예: 3000000"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <button
                                            onClick={handleCalculateSalary}
                                            disabled={!selectedWorkTypeId || !contractAmount}
                                            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                                        >
                                            계산 및 적용
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-blue-600 mt-2">
                                    * 선택한 근무 형태와 총 급여를 기준으로 기본급, 연장/휴일/주휴 수당을 자동으로 계산하여 아래 항목에 입력합니다.
                                </p>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                    <span className="w-1 h-6 bg-blue-500 rounded-full mr-3"></span>
                                    지급 항목 (Allowances)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {allowances.map(item => (
                                        <div key={item.component_id}>
                                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                                {item.salary_components?.name}
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-gray-400">₩</span>
                                                <input
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => handleSalaryChange(item.component_id, Number(e.target.value))}
                                                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium text-gray-800"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                    <span className="w-1 h-6 bg-red-500 rounded-full mr-3"></span>
                                    공제 항목 (Deductions)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {deductions.map(item => (
                                        <div key={item.component_id}>
                                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                                {item.salary_components?.name}
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-gray-400">₩</span>
                                                <input
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => handleSalaryChange(item.component_id, Number(e.target.value))}
                                                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-right font-medium text-gray-800"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>


                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button
                        onClick={handleSaveAll}
                        className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-bold shadow-md text-lg"
                    >
                        <Save size={20} className="mr-2" /> 저장
                    </button>
                </div>

                <datalist id="store-list-modal">
                    {stores?.map((store) => (
                        <option key={store} value={store} />
                    ))}
                </datalist>
            </div >
        </div >

    );
}
