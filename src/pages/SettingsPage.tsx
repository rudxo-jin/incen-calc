import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import { DEFAULT_THRESHOLDS } from '../utils/calculator';

interface AppSettings {
    id: number;
    stores: string[];
    thresholds: Record<string, [number, number, number]>;
}

export function SettingsPage() {
    const queryClient = useQueryClient();
    const [localStores, setLocalStores] = useState<string[]>([]);
    const [newStore, setNewStore] = useState('');
    const [localThresholds, setLocalThresholds] = useState(DEFAULT_THRESHOLDS);
    const [isDirty, setIsDirty] = useState(false);

    // Fetch Settings
    const { data: settings, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .single();

            if (error) throw error;

            // Ensure defaults if empty
            return {
                ...data,
                stores: data.stores || [],
                thresholds: data.thresholds && Object.keys(data.thresholds).length > 0 ? data.thresholds : DEFAULT_THRESHOLDS
            } as AppSettings;
        }
    });

    // Sync state with fetched data
    useEffect(() => {
        if (settings) {
            setLocalStores(settings.stores);
            setLocalThresholds(settings.thresholds);
        }
    }, [settings]);

    // Mutation to save settings
    const saveMutation = useMutation({
        mutationFn: async (newSettings: Partial<AppSettings>) => {
            // We assume ID 1 exists from the setup script
            const { error } = await supabase
                .from('settings')
                .update({
                    stores: newSettings.stores,
                    thresholds: newSettings.thresholds,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            setIsDirty(false);
            alert('설정이 저장되었습니다.');
        },
        onError: (error) => {
            console.error('Failed to save settings:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    });

    const handleAddStore = () => {
        if (newStore.trim() && !localStores.includes(newStore.trim())) {
            setLocalStores([...localStores, newStore.trim()]);
            setNewStore('');
            setIsDirty(true);
        }
    };

    const handleDeleteStore = (storeToDelete: string) => {
        if (confirm(`${storeToDelete} 점포를 삭제하시겠습니까?`)) {
            setLocalStores(localStores.filter(s => s !== storeToDelete));
            setIsDirty(true);
        }
    };

    const handleThresholdChange = (position: string, index: number, value: string) => {
        // Remove commas and parse
        const numValue = Number(value.replace(/,/g, ''));
        if (isNaN(numValue)) return;

        setLocalThresholds(prev => ({
            ...prev,
            [position]: prev[position].map((v, i) => i === index ? numValue : v) as [number, number, number]
        }));
        setIsDirty(true);
    };

    const handleSave = () => {
        saveMutation.mutate({
            stores: localStores,
            thresholds: localThresholds
        });
    };

    const handleResetThresholds = () => {
        if (confirm('모든 기준값을 기본값으로 초기화하시겠습니까?')) {
            setLocalThresholds(DEFAULT_THRESHOLDS);
            setIsDirty(true);
        }
    };

    if (isLoading) return <div className="p-8 text-center">로딩 중...</div>;

    return (
        <div className="space-y-8 max-w-4xl mx-auto pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">환경 설정 (Cloud)</h2>
                {isDirty && (
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm animate-pulse"
                    >
                        <Save size={18} />
                        변경사항 저장
                    </button>
                )}
            </div>

            {/* Store Management Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">점포 관리</h3>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newStore}
                        onChange={(e) => setNewStore(e.target.value)}
                        placeholder="새 점포명 입력"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddStore()}
                    />
                    <button
                        onClick={handleAddStore}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        <Plus size={20} />
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {localStores.map(store => (
                        <div key={store} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                            <span className="font-medium">{store}</span>
                            <button
                                onClick={() => handleDeleteStore(store)}
                                className="text-blue-400 hover:text-red-500"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {localStores.length === 0 && (
                        <span className="text-gray-400 text-sm">등록된 점포가 없습니다.</span>
                    )}
                </div>
            </div>

            {/* Incentive Thresholds Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900">직급별 인센티브 기준 (단위: 천원)</h3>
                    <button
                        onClick={handleResetThresholds}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                    >
                        <RotateCcw size={14} />
                        기본값 복원
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">직급</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">1단계 (3%)</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">2단계 (5%)</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">3단계 (10%/7%)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {Object.entries(localThresholds).map(([position, thresholds]) => (
                                <tr key={position} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{position}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-gray-400 text-xs">초과 ~</span>
                                            <input
                                                type="text"
                                                value={thresholds[0].toLocaleString()}
                                                onChange={(e) => handleThresholdChange(position, 0, e.target.value)}
                                                className="w-24 text-right px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-gray-400 text-xs">~</span>
                                            <input
                                                type="text"
                                                value={thresholds[1].toLocaleString()}
                                                onChange={(e) => handleThresholdChange(position, 1, e.target.value)}
                                                className="w-24 text-right px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-gray-400 text-xs">~</span>
                                            <input
                                                type="text"
                                                value={position === '기사' ? '무제한' : thresholds[2].toLocaleString()}
                                                onChange={(e) => handleThresholdChange(position, 2, e.target.value)}
                                                disabled={position === '기사'}
                                                className={`w-24 text-right px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none ${position === '기사' ? 'bg-gray-100 text-gray-500' : ''}`}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-4 text-sm text-gray-500">
                    * 각 단계의 금액은 해당 구간의 <strong>상한선</strong>을 의미합니다. (단, 1단계는 시작점)<br />
                    * 기사 직급은 2단계 상한선 이후로 무제한 적용됩니다 (7%).
                </p>
            </div>
        </div>
    );
}
