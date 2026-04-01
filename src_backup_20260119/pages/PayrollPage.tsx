import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FileText, Calculator, Download, ChevronLeft, ChevronRight, Search, Eye, EyeOff, Wand2, Filter, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import {
    calculateHealthInsurance,
    calculateLongTermCare,
    calculateEmploymentInsurance,
    calculateIncomeTax,
    calculateLocalIncomeTax
} from '../utils/payrollCalculations';

interface Employee {
    id: number;
    name: string;
    position: string;
    store_name: string;
    work_types?: { name: string };
}

interface SalaryComponent {
    id: number;
    name: string;
    type: 'allowance' | 'deduction';
}

interface PayrollRecord {
    id: number;
    employee_id: number;
    year: number;
    month: number;
    total_allowance: number;
    total_deduction: number;
    net_pay: number;
    employees?: Employee;
    payroll_items?: PayrollItem[];
}

interface PayrollItem {
    id: number;
    payroll_id: number;
    component_id: number;
    amount: number;
    salary_components?: SalaryComponent;
}

interface IncentiveDetail {
    employee_name: string;
    incentive_amount: number;
    extra_incentives?: Record<string, number>;
}

export function PayrollPage() {
    const queryClient = useQueryClient();
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [isEditing, setIsEditing] = useState(false);
    const [editedValues, setEditedValues] = useState<Record<string, number>>({}); // key: `${payrollId}-${componentId}`
    const [showHiddenColumns, setShowHiddenColumns] = useState(false);

    // --- Sort & Filter State ---
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState({
        name: '',
        store: '',
        position: ''
    });

    // --- Queries ---

    // 1. Fetch Settings for Position List
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase.from('settings').select('*').single();
            if (error) throw error;
            return data;
        }
    });

    // 2. Fetch Payroll Records for selected month
    const { data: payrolls, isLoading } = useQuery({
        queryKey: ['payroll_records', year, month],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payroll_records')
                .select(`
                    *,
                    employees (
                        id, 
                        name, 
                        position, 
                        store_name, 
                        dependents_count, 
                        work_types(name),
                        employee_salary_settings (
                            component_id,
                            amount
                        )
                    ),
                    payroll_items (
                        amount,
                        salary_components (id, name, type)
                    )
                `)
                .eq('year', year)
                .eq('month', month);

            if (error) throw error;
            return data as PayrollRecord[];
        }
    });

    // 3. Fetch All Components (for table headers)
    const { data: allComponents } = useQuery({
        queryKey: ['salary_components'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('salary_components')
                .select('*')
                .order('sort_order', { ascending: true })
                .order('id', { ascending: true });
            if (error) throw error;
            return data as SalaryComponent[];
        }
    });

    // --- Derived Data (Filter & Sort) ---
    const processedPayrolls = useMemo(() => {
        if (!payrolls) return [];
        let processed = [...payrolls];

        // 1. Filter
        if (filters.name) {
            processed = processed.filter(p => p.employees?.name.includes(filters.name));
        }
        if (filters.store) {
            processed = processed.filter(p => p.employees?.store_name?.includes(filters.store));
        }
        if (filters.position) {
            processed = processed.filter(p => p.employees?.position.includes(filters.position));
        }

        // 2. Sort
        if (sortConfig) {
            processed.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'name') {
                    aValue = a.employees?.name || '';
                    bValue = b.employees?.name || '';
                } else if (sortConfig.key === 'store_name') {
                    aValue = a.employees?.store_name || '';
                    bValue = b.employees?.store_name || '';
                } else if (sortConfig.key === 'position') {
                    aValue = a.employees?.position || '';
                    bValue = b.employees?.position || '';
                } else {
                    aValue = a[sortConfig.key as keyof typeof a];
                    bValue = b[sortConfig.key as keyof typeof b];
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return processed;
    }, [payrolls, sortConfig, filters]);

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="ml-1 text-blue-600" />
            : <ArrowDown size={14} className="ml-1 text-blue-600" />;
    };

    // --- Mutations ---

    const updatePayrollMutation = useMutation({
        mutationFn: async (values?: Record<string, number>) => {
            const targetValues = values || editedValues;
            if (Object.keys(targetValues).length === 0) return;

            // Group updates by payroll_id to recalculate totals
            const itemUpdates: { payroll_id: number; component_id: number; amount: number }[] = [];

            // 1. Prepare Item Updates
            for (const [key, amount] of Object.entries(targetValues)) {
                const [payrollIdStr, componentIdStr] = key.split('-');
                const payrollId = Number(payrollIdStr);
                const componentId = Number(componentIdStr);

                itemUpdates.push({ payroll_id: payrollId, component_id: componentId, amount });
            }

            // 2. Upsert Items
            if (itemUpdates.length > 0) {
                const { error: itemError } = await supabase
                    .from('payroll_items')
                    .upsert(itemUpdates, { onConflict: 'payroll_id, component_id' }); // Ensure unique constraint exists or use ID if available
                if (itemError) throw itemError;
            }

            // 3. Recalculate Totals for affected records
            // We need to fetch the updated items for these payrolls to get the full sum
            const affectedPayrollIds = [...new Set(itemUpdates.map(i => i.payroll_id))];

            for (const pid of affectedPayrollIds) {
                const { data: items } = await supabase
                    .from('payroll_items')
                    .select('amount, salary_components(type)')
                    .eq('payroll_id', pid);

                if (items) {
                    let totalAllowance = 0;
                    let totalDeduction = 0;
                    items.forEach(i => {
                        const comp = i.salary_components as any;
                        const type = Array.isArray(comp) ? comp[0]?.type : comp?.type;
                        if (type === 'allowance') totalAllowance += i.amount;
                        else totalDeduction += i.amount;
                    });

                    await supabase
                        .from('payroll_records')
                        .update({
                            total_allowance: totalAllowance,
                            total_deduction: totalDeduction,
                            net_pay: totalAllowance - totalDeduction
                        })
                        .eq('id', pid);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll_records'] });
            setIsEditing(false);
            setEditedValues({});
            alert('저장되었습니다.');
        },
        onError: (err) => {
            console.error(err);
            alert('저장 중 오류가 발생했습니다: ' + err.message);
        }
    });

    const generatePayrollMutation = useMutation({
        mutationFn: async () => {
            // 1. Check if already exists
            if (payrolls && payrolls.length > 0) {
                if (!confirm(`${year}년 ${month}월 급여대장이 이미 존재합니다. 재생성하시겠습니까?\n(기존 데이터는 삭제됩니다.)`)) {
                    return;
                }
                // Delete existing
                const { error: delError } = await supabase
                    .from('payroll_records')
                    .delete()
                    .eq('year', year)
                    .eq('month', month);
                if (delError) throw delError;
            }

            // 2. Fetch Active Employees & Settings
            const { data: employees, error: empError } = await supabase
                .from('employees')
                .select(`
                    *,
                    dependents_count,
                    employee_salary_settings (
                        amount,
                        component_id,
                        salary_components (id, name, type)
                    )
                `)
                .eq('is_active', true);
            if (empError) throw empError;

            // 3. Fetch Incentives for this month
            const { data: monthlyRecord } = await supabase
                .from('monthly_records')
                .select('id')
                .eq('year', year)
                .eq('month', month)
                .single();

            let incentives: IncentiveDetail[] = [];
            if (monthlyRecord) {
                const { data: incentiveDetails } = await supabase
                    .from('incentive_details')
                    .select('employee_name, incentive_amount, extra_incentives')
                    .eq('record_id', monthlyRecord.id);
                if (incentiveDetails) incentives = incentiveDetails;
            }

            // 4. Fetch All Components to identify Deduction IDs
            const { data: components } = await supabase
                .from('salary_components')
                .select('*');

            if (!components) throw new Error('급여 항목을 불러올 수 없습니다.');

            const npId = components.find(c => c.name === '국민연금')?.id;
            const hiId = components.find(c => c.name === '건강보험')?.id;
            const ltcId = components.find(c => c.name === '장기요양보험')?.id;
            const eiId = components.find(c => c.name === '고용보험')?.id;
            const itId = components.find(c => c.name === '소득세')?.id;
            const litId = components.find(c => c.name === '지방소득세')?.id;
            const bonusComponentId = components.find(c => c.name === '인센티브(매출)')?.id;

            const deductionIds = [npId, hiId, ltcId, eiId, itId, litId].filter(id => id !== undefined) as number[];


            // 5. Generate Records
            for (const emp of employees) {
                let totalAllowance = 0;
                let totalDeduction = 0;
                const itemsToInsert: { component_id: number; amount: number; }[] = [];

                // 5.1 Calculate Total Allowance first (Base + Settings + Incentive)

                // Add Base Salary if needed (though usually it's broken down into components)
                // Assuming 'employee_salary_settings' contains the breakdown.

                // Add Incentive
                const empIncentive = incentives.find(i => i.employee_name === emp.name);
                let incentiveAmount = 0;
                if (empIncentive) {
                    incentiveAmount = empIncentive.incentive_amount;
                    // Add extra incentives
                    if (empIncentive.extra_incentives) {
                        const extraSum = Object.values(empIncentive.extra_incentives).reduce((sum, val) => sum + (Number(val) || 0), 0);
                        incentiveAmount += extraSum;
                    }
                }

                // Process Settings (Allowances only first)
                if (emp.employee_salary_settings) {
                    for (const setting of emp.employee_salary_settings) {
                        // Skip if it's a standard deduction component (we will calculate these)
                        if (deductionIds.includes(setting.component_id)) continue;

                        const amount = setting.amount;
                        itemsToInsert.push({ component_id: setting.component_id, amount });

                        if (setting.salary_components?.type === 'allowance') {
                            totalAllowance += amount;
                        } else {
                            // Non-standard deduction (e.g. Union Fee)
                            totalDeduction += amount;
                        }
                    }
                }

                // Add Incentive to Items and Total
                if (incentiveAmount > 0 && bonusComponentId) {
                    itemsToInsert.push({ component_id: bonusComponentId, amount: incentiveAmount });
                    totalAllowance += incentiveAmount;
                }

                // 5.2 Calculate Standard Deductions based on Total Allowance

                // National Pension: Check for manual setting
                let np = 0;
                const manualNp = emp.employee_salary_settings?.find((s: any) => s.component_id === npId);
                if (manualNp) {
                    np = manualNp.amount;
                } else {
                    // If no manual setting, we might want to default to 0 or auto-calc?
                    // User request: "If input is missing, display missing in payroll ledger".
                    // So we set it to 0 here, and the UI will flag it.
                    np = 0;
                }

                const hi = hiId ? calculateHealthInsurance(totalAllowance) : 0;
                const ltc = ltcId ? calculateLongTermCare(hi) : 0;
                const ei = eiId ? calculateEmploymentInsurance(totalAllowance) : 0;
                const it = itId ? calculateIncomeTax(totalAllowance, emp.dependents_count || 1) : 0;
                const lit = litId ? calculateLocalIncomeTax(it) : 0;

                // Add Deductions to Items and Total
                if (npId) { itemsToInsert.push({ component_id: npId, amount: np }); totalDeduction += np; }
                if (hiId) { itemsToInsert.push({ component_id: hiId, amount: hi }); totalDeduction += hi; }
                if (ltcId) { itemsToInsert.push({ component_id: ltcId, amount: ltc }); totalDeduction += ltc; }
                if (eiId) { itemsToInsert.push({ component_id: eiId, amount: ei }); totalDeduction += ei; }
                if (itId) { itemsToInsert.push({ component_id: itId, amount: it }); totalDeduction += it; }
                if (litId) { itemsToInsert.push({ component_id: litId, amount: lit }); totalDeduction += lit; }

                const netPay = totalAllowance - totalDeduction;

                // Insert Record
                const { data: newRecord, error: recError } = await supabase
                    .from('payroll_records')
                    .insert({
                        employee_id: emp.id,
                        year,
                        month,
                        total_allowance: totalAllowance,
                        total_deduction: totalDeduction,
                        net_pay: netPay
                    })
                    .select()
                    .single();

                if (recError) throw recError;

                // Insert Items
                if (itemsToInsert.length > 0) {
                    const { error: itemError } = await supabase
                        .from('payroll_items')
                        .insert(itemsToInsert.map(item => ({
                            payroll_id: newRecord.id,
                            component_id: item.component_id,
                            amount: item.amount
                        })));
                    if (itemError) throw itemError;
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll_records'] });
            alert('급여 대장이 생성되었습니다.');
        },
        onError: (err) => {
            console.error(err);
            alert('생성 중 오류가 발생했습니다: ' + err.message);
        }
    });

    // --- Helpers ---
    const handlePrevMonth = () => {
        if (month === 1) {
            setYear(y => y - 1);
            setMonth(12);
        } else {
            setMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (month === 12) {
            setYear(y => y + 1);
            setMonth(1);
        } else {
            setMonth(m => m + 1);
        }
    };



    const recalculateRow = (record: PayrollRecord, currentEditedValues: Record<string, number>) => {
        if (!allComponents) return {};

        const getVal = (compId: number) => {
            const key = `${record.id}-${compId}`;
            return currentEditedValues[key] !== undefined ? currentEditedValues[key] : (record.payroll_items?.find(i => i.salary_components?.id === compId)?.amount || 0);
        };

        // 1. Calculate Total Allowance
        let taxableIncome = 0;
        const allowanceComps = allComponents.filter(c => c.type === 'allowance');
        allowanceComps.forEach(comp => {
            taxableIncome += getVal(comp.id);
        });

        // 2. Calculate Deductions
        const npId = allComponents.find(c => c.name === '국민연금')?.id;
        const hiId = allComponents.find(c => c.name === '건강보험')?.id;
        const ltcId = allComponents.find(c => c.name === '장기요양보험')?.id;
        const eiId = allComponents.find(c => c.name === '고용보험')?.id;
        const itId = allComponents.find(c => c.name === '소득세')?.id;
        const litId = allComponents.find(c => c.name === '지방소득세')?.id;

        const newDeductions: Record<string, number> = {};

        // National Pension: Fixed
        let np = 0;
        if (npId) {
            const empSettings = (record.employees as any)?.employee_salary_settings;
            const manualNp = empSettings?.find((s: any) => s.component_id === npId);
            if (manualNp) {
                np = manualNp.amount;
            } else {
                np = getVal(npId);
            }
            newDeductions[`${record.id}-${npId}`] = np;
        }

        const hi = hiId ? calculateHealthInsurance(taxableIncome) : 0;
        if (hiId) newDeductions[`${record.id}-${hiId}`] = hi;

        const ltc = ltcId ? calculateLongTermCare(hi) : 0;
        if (ltcId) newDeductions[`${record.id}-${ltcId}`] = ltc;

        const ei = eiId ? calculateEmploymentInsurance(taxableIncome) : 0;
        if (eiId) newDeductions[`${record.id}-${eiId}`] = ei;

        const dependents = (record.employees as any)?.dependents_count || 1;
        const it = itId ? calculateIncomeTax(taxableIncome, dependents) : 0;
        if (itId) newDeductions[`${record.id}-${itId}`] = it;

        const lit = litId ? calculateLocalIncomeTax(it) : 0;
        if (litId) newDeductions[`${record.id}-${litId}`] = lit;

        return newDeductions;
    };

    const handleValueChange = (payrollId: number, componentId: number, value: string) => {
        const numValue = Number(value) || 0;

        setEditedValues(prev => {
            const next = { ...prev, [`${payrollId}-${componentId}`]: numValue };

            // Trigger auto-recalculation for this row if it's an allowance
            const comp = allComponents?.find(c => c.id === componentId);
            if (comp?.type === 'allowance') {
                const record = payrolls?.find(p => p.id === payrollId);
                if (record) {
                    const recalculated = recalculateRow(record, next);
                    return { ...next, ...recalculated };
                }
            }

            return next;
        });
    };

    const getDisplayValue = (record: PayrollRecord, componentId: number) => {
        const key = `${record.id}-${componentId}`;
        if (isEditing && editedValues[key] !== undefined) {
            return editedValues[key];
        }
        const item = record.payroll_items?.find(i => i.salary_components?.id === componentId);
        return item ? item.amount : 0;
    };

    // Dynamic Totals Helpers
    const getCurrentTotalAllowance = (record: PayrollRecord) => {
        if (!allComponents) return record.total_allowance;
        let total = 0;
        const allowanceComps = allComponents.filter(c => c.type === 'allowance');
        allowanceComps.forEach(c => {
            total += getDisplayValue(record, c.id);
        });
        return total;
    };

    const getCurrentTotalDeduction = (record: PayrollRecord) => {
        if (!allComponents) return record.total_deduction;
        let total = 0;
        const deductionComps = allComponents.filter(c => c.type === 'deduction');
        deductionComps.forEach(c => {
            total += getDisplayValue(record, c.id);
        });
        return total;
    };

    const getCurrentNetPay = (record: PayrollRecord) => {
        return getCurrentTotalAllowance(record) - getCurrentTotalDeduction(record);
    };

    const calculateDeductions = () => {
        if (!payrolls || !allComponents) return;
        if (!confirm('현재 입력된 지급액을 기준으로 공제 항목을 자동 계산하시겠습니까?\n(기존 입력된 공제액은 덮어씌워집니다.)')) return;

        const newEditedValues = { ...editedValues };

        // Find Deduction Component IDs
        const npId = allComponents.find(c => c.name === '국민연금')?.id;
        const hiId = allComponents.find(c => c.name === '건강보험')?.id;
        const ltcId = allComponents.find(c => c.name === '장기요양보험')?.id;
        const eiId = allComponents.find(c => c.name === '고용보험')?.id;
        const itId = allComponents.find(c => c.name === '소득세')?.id;
        const litId = allComponents.find(c => c.name === '지방소득세')?.id;

        payrolls.forEach(record => {
            // Calculate Total Allowance (Taxable Income)
            // Note: We assume all allowances are taxable for now.
            // To be precise, we should check 'is_taxable' from salary_components, but that data might not be fully joined here or needs lookup.
            // For MVP, we sum all allowances.

            let taxableIncome = 0;
            const allowanceComps = allComponents.filter(c => c.type === 'allowance');

            allowanceComps.forEach(comp => {
                taxableIncome += getDisplayValue(record, comp.id);
            });

            // Calculate Deductions
            // Calculate Deductions
            // National Pension: Use setting if available, otherwise keep existing value (don't recalc based on income)
            let np = 0;
            if (npId) {
                const empSettings = (record.employees as any)?.employee_salary_settings;
                const manualNp = empSettings?.find((s: any) => s.component_id === npId);

                if (manualNp) {
                    np = manualNp.amount;
                } else {
                    // If no manual setting, keep the current value (edited or original)
                    np = getDisplayValue(record, npId);
                }
            }

            const hi = hiId ? calculateHealthInsurance(taxableIncome) : 0;
            const ltc = ltcId ? calculateLongTermCare(hi) : 0;
            const ei = eiId ? calculateEmploymentInsurance(taxableIncome) : 0;
            // Use dependents_count from the joined employee record
            const dependents = (record.employees as any)?.dependents_count || 1;
            const it = itId ? calculateIncomeTax(taxableIncome, dependents) : 0;
            const lit = litId ? calculateLocalIncomeTax(it) : 0;

            // Update Edited Values
            if (npId) newEditedValues[`${record.id}-${npId}`] = np;
            if (hiId) newEditedValues[`${record.id}-${hiId}`] = hi;
            if (ltcId) newEditedValues[`${record.id}-${ltcId}`] = ltc;
            if (eiId) newEditedValues[`${record.id}-${eiId}`] = ei;
            if (itId) newEditedValues[`${record.id}-${itId}`] = it;
            if (litId) newEditedValues[`${record.id}-${litId}`] = lit;
        });

        setEditedValues(newEditedValues);
        alert('공제 항목 계산이 완료되었습니다. [저장] 버튼을 눌러 확정하세요.');
    };

    const handleSave = () => {
        if (!payrolls || !allComponents) return;

        const newEditedValues = { ...editedValues };

        // Find Deduction Component IDs
        const npId = allComponents.find(c => c.name === '국민연금')?.id;
        const hiId = allComponents.find(c => c.name === '건강보험')?.id;
        const ltcId = allComponents.find(c => c.name === '장기요양보험')?.id;
        const eiId = allComponents.find(c => c.name === '고용보험')?.id;
        const itId = allComponents.find(c => c.name === '소득세')?.id;
        const litId = allComponents.find(c => c.name === '지방소득세')?.id;

        payrolls.forEach(record => {
            // 1. Calculate Total Allowance (Taxable Income)
            let taxableIncome = 0;
            const allowanceComps = allComponents.filter(c => c.type === 'allowance');

            allowanceComps.forEach(comp => {
                taxableIncome += getDisplayValue(record, comp.id);
            });

            // 2. Calculate Deductions
            // National Pension: Use setting if available, otherwise keep existing value (don't recalc based on income)
            // Constraint: "재계산 시에도 국민연금은 직원관리>급여설정에서 등록된 금액으로 고정되어야 함"
            let np = 0;
            if (npId) {
                const empSettings = (record.employees as any)?.employee_salary_settings;
                const manualNp = empSettings?.find((s: any) => s.component_id === npId);

                if (manualNp) {
                    np = manualNp.amount;
                } else {
                    // If no manual setting, keep the current value (edited or original)
                    // Do NOT recalculate using calculateNationalPension(taxableIncome)
                    np = getDisplayValue(record, npId);
                }
            }

            const hi = hiId ? calculateHealthInsurance(taxableIncome) : 0;
            const ltc = ltcId ? calculateLongTermCare(hi) : 0;
            const ei = eiId ? calculateEmploymentInsurance(taxableIncome) : 0;
            const dependents = (record.employees as any)?.dependents_count || 1;
            const it = itId ? calculateIncomeTax(taxableIncome, dependents) : 0;
            const lit = litId ? calculateLocalIncomeTax(it) : 0;

            // 3. Update Edited Values
            if (npId) newEditedValues[`${record.id}-${npId}`] = np;
            if (hiId) newEditedValues[`${record.id}-${hiId}`] = hi;
            if (ltcId) newEditedValues[`${record.id}-${ltcId}`] = ltc;
            if (eiId) newEditedValues[`${record.id}-${eiId}`] = ei;
            if (itId) newEditedValues[`${record.id}-${itId}`] = it;
            if (litId) newEditedValues[`${record.id}-${litId}`] = lit;
        });

        setEditedValues(newEditedValues);
        // We need to wait for state update? No, state update is async.
        // But we can pass the new values directly to mutation if we refactor mutation to accept values.
        // Or, simpler: update state, then call mutation. 
        // React state updates are batched. Calling mutate immediately might use old state.
        // Better approach: Pass the new values to a modified version of updatePayrollMutation or update the state and use useEffect?
        // Actually, since we are inside the component, we can just call the mutation logic directly with the new values.
        // But updatePayrollMutation reads from 'editedValues' state.

        // Workaround: Update state, and also update the mutation to accept an optional argument.
        // Or, just update the mutation to use the values we pass.

        // Let's modify updatePayrollMutation to accept values.
        // But for now, to avoid changing mutation signature too much, let's just update the state and rely on the fact that we can't easily await state update.
        // Actually, we can just call the mutation with the new object directly if we change the mutation.

        // Let's change the mutation to take an optional argument.
        updatePayrollMutation.mutate(newEditedValues as any);
    };

    const totalCost = processedPayrolls?.reduce((sum, p) => sum + p.total_allowance, 0) || 0;
    const totalNet = processedPayrolls?.reduce((sum, p) => sum + p.net_pay, 0) || 0;

    // Columns for Table
    // Filter out columns that have 0 amount for ALL displayed records if showHiddenColumns is false
    const getActiveComponentIds = () => {
        if (!processedPayrolls) return new Set<number>();
        const activeIds = new Set<number>();
        processedPayrolls.forEach(record => {
            allComponents?.forEach(comp => {
                if (getDisplayValue(record, comp.id) > 0) {
                    activeIds.add(comp.id);
                }
            });
        });
        return activeIds;
    };

    const activeIds = getActiveComponentIds();

    const allowanceComps = allComponents?.filter(c => c.type === 'allowance' && (showHiddenColumns || activeIds.has(c.id))) || [];
    const deductionComps = allComponents?.filter(c => c.type === 'deduction' && (showHiddenColumns || activeIds.has(c.id))) || [];

    const handleDownloadExcel = () => {
        if (!processedPayrolls || processedPayrolls.length === 0) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }

        const data = processedPayrolls.map(record => {
            const row: any = {
                '이름': record.employees?.name,
                '부서': record.employees?.store_name,
                '직급': record.employees?.position,
            };

            // Allowances
            allowanceComps.forEach(c => {
                row[c.name] = getDisplayValue(record, c.id);
            });
            row['지급계'] = record.total_allowance;

            // Deductions
            deductionComps.forEach(c => {
                row[c.name] = getDisplayValue(record, c.id);
            });
            row['공제계'] = record.total_deduction;
            row['실수령액'] = record.net_pay;

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '급여대장');

        const fileName = `급여대장_${year}년_${month}월.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="text-blue-600" />
                        급여 대장
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">월별 급여 내역을 생성하고 관리합니다.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white rounded-lg border shadow-sm p-1">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-md cursor-pointer"><ChevronLeft size={20} /></button>
                        <span className="px-4 font-bold text-lg min-w-[120px] text-center">{year}년 {month}월</span>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-md cursor-pointer"><ChevronRight size={20} /></button>
                    </div>

                    {isEditing ? (
                        <>
                            <button
                                onClick={calculateDeductions}
                                className="px-4 py-2 text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-2 cursor-pointer"
                            >
                                <Wand2 size={16} /> 공제 자동 계산
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={updatePayrollMutation.isPending}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                                {updatePayrollMutation.isPending ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        저장 중...
                                    </>
                                ) : (
                                    '저장'
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                        >
                            수정 모드
                        </button>
                    )}

                    <button
                        onClick={() => generatePayrollMutation.mutate()}
                        disabled={generatePayrollMutation.isPending || isEditing}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                        <Calculator size={18} />
                        {generatePayrollMutation.isPending ? '생성 중...' : '급여 산출'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">총 지급액 (Allowances)</p>
                    <p className="text-2xl font-bold text-blue-600">₩ {totalCost.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">총 공제액 (Deductions)</p>
                    <p className="text-2xl font-bold text-red-500">₩ {(totalCost - totalNet).toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">실 지급액 (Net Pay)</p>
                    <p className="text-2xl font-bold text-green-600">₩ {totalNet.toLocaleString()}</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-white z-30 relative">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                lang="ko"
                                style={{ imeMode: 'active' } as any}
                                placeholder="이름 검색"
                                value={filters.name}
                                onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                lang="ko"
                                style={{ imeMode: 'active' } as any}
                                placeholder="부서 필터"
                                value={filters.store}
                                onChange={e => setFilters(prev => ({ ...prev, store: e.target.value }))}
                                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32"
                            />
                        </div>
                        <select
                            value={filters.position}
                            onChange={e => setFilters(prev => ({ ...prev, position: e.target.value }))}
                            className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">전체 직급</option>
                            {settings?.positions ? (
                                Object.entries(settings.positions as Record<string, string[]>).flatMap(([_, posList]) => posList).map(pos => (
                                    <option key={pos} value={pos}>{pos}</option>
                                ))
                            ) : (
                                <>
                                    <option value="공장장">공장장</option>
                                    <option value="팀장">팀장</option>
                                    <option value="선임기사">선임기사</option>
                                    <option value="기사">기사</option>
                                    <option value="수습">수습</option>
                                    <option value="기타">기타</option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showHiddenColumns}
                                onChange={e => setShowHiddenColumns(e.target.checked)}
                                className="rounded text-blue-600"
                            />
                            {showHiddenColumns ? <Eye size={16} /> : <EyeOff size={16} />}
                            <span>0원 항목 보기</span>
                        </label>
                        <button
                            onClick={handleDownloadExcel}
                            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm cursor-pointer"
                        >
                            <Download size={16} /> 엑셀 다운로드
                        </button>
                    </div>
                </div>

                <div className="overflow-auto max-h-[calc(100vh-350px)] relative">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-700 font-medium border-b sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th
                                    className="px-4 py-3 sticky left-0 bg-gray-50 z-30 cursor-pointer hover:bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center">이름 <SortIcon column="name" /></div>
                                </th>
                                <th
                                    className="px-4 py-3 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('store_name')}
                                >
                                    <div className="flex items-center">부서 <SortIcon column="store_name" /></div>
                                </th>
                                <th
                                    className="px-4 py-3 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('position')}
                                >
                                    <div className="flex items-center">직급 <SortIcon column="position" /></div>
                                </th>
                                {/* Dynamic Allowance Headers */}
                                {allowanceComps.map(c => (
                                    <th key={c.id} className="px-4 py-3 text-right min-w-[100px] text-blue-700 bg-blue-50/30">{c.name}</th>
                                ))}
                                <th
                                    className="px-4 py-3 text-right font-bold bg-blue-100/50 cursor-pointer hover:bg-blue-100"
                                    onClick={() => handleSort('total_allowance')}
                                >
                                    <div className="flex items-center justify-end">지급계 <SortIcon column="total_allowance" /></div>
                                </th>
                                {/* Dynamic Deduction Headers */}
                                {deductionComps.map(c => (
                                    <th key={c.id} className="px-4 py-3 text-right min-w-[100px] text-red-700 bg-red-50/30">{c.name}</th>
                                ))}
                                <th
                                    className="px-4 py-3 text-right font-bold bg-red-100/50 cursor-pointer hover:bg-red-100"
                                    onClick={() => handleSort('total_deduction')}
                                >
                                    <div className="flex items-center justify-end">공제계 <SortIcon column="total_deduction" /></div>
                                </th>
                                <th
                                    className="px-4 py-3 text-right font-bold bg-green-50 text-green-700 cursor-pointer hover:bg-green-100"
                                    onClick={() => handleSort('net_pay')}
                                >
                                    <div className="flex items-center justify-end">실수령액 <SortIcon column="net_pay" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr><td colSpan={100} className="p-8 text-center text-gray-500">로딩 중...</td></tr>
                            ) : processedPayrolls?.length === 0 ? (
                                <tr><td colSpan={100} className="p-8 text-center text-gray-500">데이터가 없습니다. '급여 산출' 버튼을 눌러 생성하세요.</td></tr>
                            ) : (
                                processedPayrolls?.map(record => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium sticky left-0 bg-white z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{record.employees?.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{record.employees?.store_name}</td>
                                        <td className="px-4 py-3 text-gray-500">{record.employees?.position}</td>

                                        {/* Allowances */}
                                        {allowanceComps.map(c => {
                                            const val = getDisplayValue(record, c.id);
                                            return (
                                                <td key={c.id} className="px-4 py-3 text-right text-gray-600">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            value={val}
                                                            onChange={e => handleValueChange(record.id, c.id, e.target.value)}
                                                            className="w-24 p-1 border rounded text-right bg-blue-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    ) : (
                                                        val.toLocaleString()
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-3 text-right font-bold text-blue-600 bg-blue-50/10">
                                            {getCurrentTotalAllowance(record).toLocaleString()}
                                        </td>

                                        {/* Deductions */}
                                        {deductionComps.map(c => {
                                            const val = getDisplayValue(record, c.id);
                                            return (
                                                <td key={c.id} className="px-4 py-3 text-right text-gray-600">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            value={val}
                                                            onChange={e => handleValueChange(record.id, c.id, e.target.value)}
                                                            className={`w-24 p-1 border rounded text-right focus:bg-white focus:ring-2 focus:ring-red-500 outline-none ${c.name === '국민연금' && val === 0 ? 'bg-red-100 border-red-300' : 'bg-red-50'}`}
                                                        />
                                                    ) : (
                                                        c.name === '국민연금' && val === 0 ? (
                                                            <span className="text-red-500 font-bold bg-red-100 px-2 py-1 rounded text-xs">누락</span>
                                                        ) : (
                                                            val.toLocaleString()
                                                        )
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-3 text-right font-bold text-red-600 bg-red-50/10">
                                            {getCurrentTotalDeduction(record).toLocaleString()}
                                        </td>

                                        <td className="px-4 py-3 text-right font-bold text-green-600 bg-green-50/30">
                                            {getCurrentNetPay(record).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
