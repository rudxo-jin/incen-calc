import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Save, RotateCcw, Settings, DollarSign, Clock, Briefcase, GripVertical } from 'lucide-react';
import { DEFAULT_THRESHOLDS } from '../utils/calculator';
import { WorkTypeSettings } from '../components/WorkTypeSettings';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AppSettings {
    id: number;
    stores: string[];
    thresholds: Record<string, [number, number, number]>;
    incentiveCategories: string[];
    positions: Record<string, string[]>;
}

const DEFAULT_POSITIONS = {
    "현장직": ["수습", "사원", "선임기사", "팀장", "공장장"],
    "사무직": ["사원", "실장", "주임", "대리", "과장", "차장", "부장", "이사", "대표이사"]
};

function SortableItem({ id, children, onDelete }: { id: string, children: React.ReactNode, onDelete: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 rounded-lg border border-gray-200 shadow-sm group">
            <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                <GripVertical size={14} />
            </div>
            <span className="font-medium">{children}</span>
            <button
                onClick={onDelete}
                className="text-gray-400 hover:text-red-500 ml-auto"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}

export function SettingsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'general' | 'incentive' | 'workType' | 'position' | 'extra'>('general');
    const [localStores, setLocalStores] = useState<string[]>([]);
    const [newStore, setNewStore] = useState('');
    const [localCategories, setLocalCategories] = useState<string[]>([]);
    const [newCategory, setNewCategory] = useState('');
    const [localThresholds, setLocalThresholds] = useState(DEFAULT_THRESHOLDS);
    const [localPositions, setLocalPositions] = useState<Record<string, string[]>>(DEFAULT_POSITIONS);
    const [newPositionCategory, setNewPositionCategory] = useState('');
    const [newPosition, setNewPosition] = useState('');
    const [selectedPositionCategory, setSelectedPositionCategory] = useState<string>('현장직');
    const [newExtraIncentive, setNewExtraIncentive] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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
                incentiveCategories: data.incentive_categories || ['택시', '빵빵', '미적용'],
                thresholds: data.thresholds && Object.keys(data.thresholds).length > 0 ? data.thresholds : DEFAULT_THRESHOLDS,
                positions: data.positions || DEFAULT_POSITIONS
            } as AppSettings;
        }
    });

    // Fetch Additional Incentive Types
    const { data: additionalIncentiveTypes, refetch: refetchExtraTypes } = useQuery({
        queryKey: ['additional_incentive_types'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('additional_incentive_types')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data as { id: number, name: string }[];
        }
    });

    const addExtraTypeMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await supabase
                .from('additional_incentive_types')
                .insert({ name });
            if (error) throw error;
        },
        onSuccess: () => {
            refetchExtraTypes();
            setNewExtraIncentive('');
            alert('추가되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            alert('추가 중 오류가 발생했습니다.');
        }
    });

    const deleteExtraTypeMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase
                .from('additional_incentive_types')
                .update({ is_active: false })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            refetchExtraTypes();
            alert('삭제되었습니다.');
        },
        onError: (error) => {
            console.error(error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    });

    const handleAddExtraIncentive = () => {
        if (newExtraIncentive.trim()) {
            addExtraTypeMutation.mutate(newExtraIncentive.trim());
        }
    };

    const handleDeleteExtraIncentive = (id: number) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            deleteExtraTypeMutation.mutate(id);
        }
    };

    // Sync state with fetched data
    useEffect(() => {
        if (settings) {
            setLocalStores(settings.stores || []);
            setLocalCategories(settings.incentiveCategories || []);
            setLocalThresholds(settings.thresholds || DEFAULT_THRESHOLDS);
            setLocalPositions(settings.positions || DEFAULT_POSITIONS);
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
                    incentive_categories: newSettings.incentiveCategories,
                    thresholds: newSettings.thresholds,
                    positions: newSettings.positions,
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
        if (confirm(`${storeToDelete} 부서를 삭제하시겠습니까?`)) {
            setLocalStores(localStores.filter(s => s !== storeToDelete));
            setIsDirty(true);
        }
    };

    const handleAddCategory = () => {
        if (newCategory.trim() && !localCategories.includes(newCategory.trim())) {
            setLocalCategories([...localCategories, newCategory.trim()]);
            setNewCategory('');
            setIsDirty(true);
        }
    };

    const handleDeleteCategory = (categoryToDelete: string) => {
        if (confirm(`${categoryToDelete} 구분을 삭제하시겠습니까?`)) {
            setLocalCategories(localCategories.filter(c => c !== categoryToDelete));
            setIsDirty(true);
        }
    };

    const handleAddPosition = () => {
        if (newPosition.trim() && selectedPositionCategory) {
            const currentPositions = localPositions[selectedPositionCategory] || [];
            if (!currentPositions.includes(newPosition.trim())) {
                setLocalPositions({
                    ...localPositions,
                    [selectedPositionCategory]: [...currentPositions, newPosition.trim()]
                });
                setNewPosition('');
                setIsDirty(true);
            }
        }
    };

    const handleDeletePosition = (category: string, positionToDelete: string) => {
        if (confirm(`${positionToDelete} 직급을 삭제하시겠습니까?`)) {
            setLocalPositions({
                ...localPositions,
                [category]: localPositions[category].filter(p => p !== positionToDelete)
            });
            setIsDirty(true);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && selectedPositionCategory) {
            setLocalPositions((prev) => {
                const currentPositions = prev[selectedPositionCategory];
                const oldIndex = currentPositions.indexOf(active.id as string);
                const newIndex = currentPositions.indexOf(over.id as string);

                return {
                    ...prev,
                    [selectedPositionCategory]: arrayMove(currentPositions, oldIndex, newIndex),
                };
            });
            setIsDirty(true);
        }
    };

    const handleAddPositionCategory = () => {
        if (newPositionCategory.trim() && !localPositions[newPositionCategory.trim()]) {
            setLocalPositions({
                ...localPositions,
                [newPositionCategory.trim()]: []
            });
            setNewPositionCategory('');
            setIsDirty(true);
        }
    };

    const handleDeletePositionCategory = (categoryToDelete: string) => {
        if (confirm(`${categoryToDelete} 직군을 삭제하시겠습니까? 하위 직급도 모두 삭제됩니다.`)) {
            const newPositions = { ...localPositions };
            delete newPositions[categoryToDelete];
            setLocalPositions(newPositions);
            if (selectedPositionCategory === categoryToDelete) {
                setSelectedPositionCategory(Object.keys(newPositions)[0] || '');
            }
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
            incentiveCategories: localCategories,
            thresholds: localThresholds,
            positions: localPositions
        });
    };

    const handleResetThresholds = () => {
        if (confirm('모든 기준값을 기본값으로 초기화하시겠습니까?')) {
            setLocalThresholds(DEFAULT_THRESHOLDS);
            setIsDirty(true);
        }
    };

    // Helper to get all positions in order for the table
    const getAllOrderedPositions = () => {
        const orderedPositions: string[] = [];
        // Iterate through categories in a stable order (or just Object.keys if order doesn't matter for categories)
        // Ideally we might want to order categories too, but for now let's just iterate.
        Object.keys(localPositions).forEach(category => {
            orderedPositions.push(...localPositions[category]);
        });

        // Also include any positions in thresholds that might not be in the list (legacy support)
        const thresholdPositions = Object.keys(localThresholds);
        thresholdPositions.forEach(pos => {
            if (!orderedPositions.includes(pos)) {
                orderedPositions.push(pos);
            }
        });

        return orderedPositions;
    };

    if (isLoading) return <div className="p-8 text-center">로딩 중...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">환경 설정 (Cloud)</h2>
                {isDirty && activeTab !== 'workType' && (
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm animate-pulse"
                    >
                        <Save size={18} />
                        변경사항 저장
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 py-4 text-center font-medium transition-colors flex items-center justify-center ${activeTab === 'general' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Settings size={18} className="mr-2" /> 일반 설정
                </button>
                <button
                    onClick={() => setActiveTab('incentive')}
                    className={`flex-1 py-4 text-center font-medium transition-colors flex items-center justify-center ${activeTab === 'incentive' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <DollarSign size={18} className="mr-2" /> 인센티브 기준
                </button>
                <button
                    onClick={() => setActiveTab('workType')}
                    className={`flex-1 py-4 text-center font-medium transition-colors flex items-center justify-center ${activeTab === 'workType' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Clock size={18} className="mr-2" /> 근무 형태 설정
                </button>
                <button
                    onClick={() => setActiveTab('position')}
                    className={`flex-1 py-4 text-center font-medium transition-colors flex items-center justify-center ${activeTab === 'position' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Briefcase size={18} className="mr-2" /> 직급 관리
                </button>
                <button
                    onClick={() => setActiveTab('extra')}
                    className={`flex-1 py-4 text-center font-medium transition-colors flex items-center justify-center ${activeTab === 'extra' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Plus size={18} className="mr-2" /> 추가 인센티브
                </button>
            </div>

            <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-6 min-h-[500px]">
                {activeTab === 'general' && (
                    <div className="space-y-8">
                        {/* Department Management Section */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-4">부서 관리</h3>
                            <div className="flex gap-2 mb-4 max-w-md">
                                <input
                                    type="text"
                                    value={newStore}
                                    onChange={(e) => setNewStore(e.target.value)}
                                    placeholder="새 부서명 입력"
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
                                {localStores?.map(store => (
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
                                    <span className="text-gray-400 text-sm">등록된 부서가 없습니다.</span>
                                )}
                            </div>
                        </div>


                        {/* Incentive Category Management Section */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-4">인센티브 구분 관리</h3>
                            <div className="flex gap-2 mb-4 max-w-md">
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    placeholder="새 구분 입력 (예: 택시, 빵빵)"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                                />
                                <button
                                    onClick={handleAddCategory}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {localCategories?.map(category => (
                                    <div key={category} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
                                        <span className="font-medium">{category}</span>
                                        <button
                                            onClick={() => handleDeleteCategory(category)}
                                            className="text-green-400 hover:text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {localCategories.length === 0 && (
                                    <span className="text-gray-400 text-sm">등록된 구분이 없습니다.</span>
                                )}
                            </div>
                        </div>
                    </div>

                )}


                {
                    activeTab === 'incentive' && (
                        <div className="space-y-6">
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
                                        {getAllOrderedPositions().map((position) => {
                                            const thresholds = localThresholds[position];
                                            if (!thresholds) return null; // Should not happen if getAllOrderedPositions works right, but safety check

                                            return (
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
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-4 text-sm text-gray-500">
                                * 각 단계의 금액은 해당 구간의 <strong>상한선</strong>을 의미합니다. (단, 1단계는 시작점)<br />
                                * 기사 직급은 2단계 상한선 이후로 무제한 적용됩니다 (7%).
                            </p>
                        </div>
                    )
                }
                {
                    activeTab === 'workType' && (
                        <WorkTypeSettings />
                    )
                }
                {
                    activeTab === 'position' && (
                        <div className="space-y-8">
                            {/* Position Category Management */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-4">직군 관리</h3>
                                <div className="flex gap-2 mb-4 max-w-md">
                                    <input
                                        type="text"
                                        value={newPositionCategory}
                                        onChange={(e) => setNewPositionCategory(e.target.value)}
                                        placeholder="새 직군 입력 (예: 기술직)"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddPositionCategory()}
                                    />
                                    <button
                                        onClick={handleAddPositionCategory}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.keys(localPositions).map(category => (
                                        <button
                                            key={category}
                                            onClick={() => setSelectedPositionCategory(category)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${selectedPositionCategory === category
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="font-medium">{category}</span>
                                            {selectedPositionCategory === category && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeletePositionCategory(category);
                                                    }}
                                                    className="ml-2 p-0.5 hover:bg-blue-500 rounded-full cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Position Management */}
                            {selectedPositionCategory && (
                                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                                        <span className="text-blue-600">{selectedPositionCategory}</span> 직급 목록 (드래그하여 순서 변경)
                                    </h3>
                                    <div className="flex gap-2 mb-4 max-w-md">
                                        <input
                                            type="text"
                                            value={newPosition}
                                            onChange={(e) => setNewPosition(e.target.value)}
                                            placeholder="새 직급 입력"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddPosition()}
                                        />
                                        <button
                                            onClick={handleAddPosition}
                                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>

                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={localPositions[selectedPositionCategory] || []}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="flex flex-col gap-2 max-w-md">
                                                {localPositions[selectedPositionCategory]?.map(position => (
                                                    <SortableItem
                                                        key={position}
                                                        id={position}
                                                        onDelete={() => handleDeletePosition(selectedPositionCategory, position)}
                                                    >
                                                        {position}
                                                    </SortableItem>
                                                ))}
                                                {(!localPositions[selectedPositionCategory] || localPositions[selectedPositionCategory].length === 0) && (
                                                    <span className="text-gray-400 text-sm">등록된 직급이 없습니다.</span>
                                                )}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            )}
                        </div>
                    )
                }

                {activeTab === 'extra' && (
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">추가 인센티브 항목 관리</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            매출 연동 인센티브 외에 별도로 지급할 인센티브 항목(예: 부품 판매, 배터리 등)을 관리합니다.<br />
                            등록된 항목은 히스토리 페이지에 자동으로 컬럼이 생성됩니다.
                        </p>

                        <div className="flex gap-2 mb-6 max-w-md">
                            <input
                                type="text"
                                value={newExtraIncentive}
                                onChange={(e) => setNewExtraIncentive(e.target.value)}
                                placeholder="새 항목 이름 입력"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddExtraIncentive()}
                            />
                            <button
                                onClick={handleAddExtraIncentive}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {additionalIncentiveTypes?.map(type => (
                                <div key={type.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <span className="font-medium text-gray-900">{type.name}</span>
                                    <button
                                        onClick={() => handleDeleteExtraIncentive(type.id)}
                                        className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            {(!additionalIncentiveTypes || additionalIncentiveTypes.length === 0) && (
                                <div className="col-span-full text-center py-8 text-gray-400">
                                    등록된 추가 인센티브 항목이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
