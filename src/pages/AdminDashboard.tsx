import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, doc, writeBatch, where, Timestamp, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Component, ProjectCode, ProjectFaculty } from '@/types';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Radio, 
  Layers, 
  Package, 
  X, 
  Boxes,
  ArrowRightLeft,
  QrCode,
  Users,
  GraduationCap,
  Trash2,
  UserCheck,
  Mail,
  Send,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GenerateCodeModal from '@/components/GenerateCodeModal';
import SearchCodeModal from '@/components/SearchCodeModal';
import IssueToStudentModal from '@/components/IssueToStudentModal';
import NotificationsModal from '@/components/NotificationsModal';
import ImageUploadField from '@/components/ImageUploadField';
import { getDueDateStatus, checkAndAutoSendDueDateNotifications, deleteProjectCodeRecord, computeNextComponentCode } from '@/lib/projectCodeService';
import { getEmailConfig, saveEmailConfig, sendTestEmail, notifyAdminOnIssue, DEFAULT_EMAIL_CONFIG, type EmailConfig } from '@/lib/emailService';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'inventory';
  
  const setActiveTab = (tab: string) => {
    if (tab === 'inventory') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<Component[]>([]);
  const [projectCodes, setProjectCodes] = useState<ProjectCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editComponent, setEditComponent] = useState<Component | null>(null);
  const [newComponent, setNewComponent] = useState({ 
    code: '',
    name: '', 
    category: 'Microcontrollers', 
    description: '', 
    quantity: 1, 
    threshold: 2,
    imageUrl: ''
  });
  const [isSeeding, setIsSeeding] = useState(false);

  const handleOpenAddModal = () => {
    setNewComponent({ 
      code: computeNextComponentCode(inventory),
      name: '', 
      category: 'Microcontrollers', 
      description: '', 
      quantity: 1, 
      threshold: 2,
      imageUrl: ''
    });
    setShowAddModal(true);
  };

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutData, setCheckoutData] = useState({ component: null as Component | null, regNumber: '', quantity: 1, days: 7 });

  // Project Code & Search Modals
  const [showGenerateCodeModal, setShowGenerateCodeModal] = useState(false);
  const [showSearchCodeModal, setShowSearchCodeModal] = useState(false);
  const [showIssueToStudentModal, setShowIssueToStudentModal] = useState(false);
  const [searchModalInitialCode, setSearchModalInitialCode] = useState('');
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Delete team state
  const [teamToDelete, setTeamToDelete] = useState<ProjectCode | null>(null);
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

  // Email Notification Settings State
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(DEFAULT_EMAIL_CONFIG);
  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');
  const [showAdvancedWebhook, setShowAdvancedWebhook] = useState(false);

  useEffect(() => {
    getEmailConfig().then(cfg => setEmailConfig(cfg));
  }, []);

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmailConfig(true);
    try {
      await saveEmailConfig(emailConfig);
      setEmailSuccessMsg('Email alert configuration saved successfully!');
      setTimeout(() => setEmailSuccessMsg(''), 4000);
    } catch (err: any) {
      alert("Failed to save email settings: " + err.message);
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  const handleTriggerTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailFeedback(null);
    try {
      const res = await sendTestEmail(emailConfig.recipientEmail);
      setTestEmailFeedback(res);
      if (res.success) {
        setEmailSuccessMsg(`Test email delivered to ${emailConfig.recipientEmail}! Check your inbox.`);
        setTimeout(() => setEmailSuccessMsg(''), 5000);
      }
    } catch (err: any) {
      setTestEmailFeedback({ success: false, message: err.message || 'Error sending test email' });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Delete component state
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null);
  const [isDeletingComponent, setIsDeletingComponent] = useState(false);

  const handleConfirmDeleteComponent = async () => {
    if (!componentToDelete) return;
    setIsDeletingComponent(true);
    try {
      const docRef = doc(db, 'inventory', componentToDelete.id);
      await deleteDoc(docRef);
      setDeleteSuccessMsg(`Component "${componentToDelete.name}" was successfully deleted from inventory.`);
      setTimeout(() => setDeleteSuccessMsg(''), 4000);
      setComponentToDelete(null);
    } catch (err: any) {
      console.error("Error deleting component:", err);
      alert(err.message || "Failed to delete component.");
    } finally {
      setIsDeletingComponent(false);
    }
  };

  const handleConfirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    setIsDeletingTeam(true);
    try {
      await deleteProjectCodeRecord(teamToDelete.code);
      setDeleteSuccessMsg(`Project team ${teamToDelete.code} was successfully deleted.`);
      setTimeout(() => setDeleteSuccessMsg(''), 4000);
      setTeamToDelete(null);
    } catch (err: any) {
      console.error("Error deleting project team:", err);
      alert(err.message || "Failed to delete team.");
    } finally {
      setIsDeletingTeam(false);
    }
  };

  useEffect(() => {
    setLoading(true);

    const txQuery = query(collection(db, 'transactions'));
    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      txData.sort((a, b) => (b.issueDate?.seconds || 0) - (a.issueDate?.seconds || 0));
      setTransactions(txData);
      setLoading(false);
      // Automatically check and dispatch notifications for nearing/overdue items
      checkAndAutoSendDueDateNotifications();
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    const invQuery = query(collection(db, 'inventory'));
    const unsubscribeInv = onSnapshot(invQuery, (snapshot) => {
      let hadDiscrepancy = false;
      const batch = writeBatch(db);

      // Determine highest existing IIC-C number among non-archived items
      let maxCodeNum = 0;
      snapshot.docs.forEach(docSnap => {
        const c = ((docSnap.data() as Component).code || '').trim().toUpperCase();
        if (c.startsWith('IIC-C')) {
          const num = parseInt(c.substring(5), 10);
          if (!isNaN(num) && num > maxCodeNum) maxCodeNum = num;
        }
      });

      const invData = snapshot.docs
        .map(docSnap => {
          const data = docSnap.data() as Component;
          const total = Math.max(0, Number(data.totalQuantity) || 0);
          const issued = Math.max(0, Number(data.issuedQuantity) || 0);
          const damaged = Math.max(0, Number(data.damagedQuantity) || 0);
          
          // Logical maximum available stock: total minus active loans and damaged items
          const maxAllowed = Math.max(0, total - issued - damaged);
          let safeAvailable = Math.max(0, Number(data.availableQuantity) || 0);

          let componentCode = data.code ? data.code.trim().toUpperCase() : '';
          let docUpdated = false;
          const docUpdates: any = {};

          // Auto-assign IIC-C code if missing (e.g. IIC-C1, IIC-C2...)
          if (!data.isArchived && (!componentCode || !componentCode.startsWith('IIC-C'))) {
            maxCodeNum += 1;
            componentCode = `IIC-C${maxCodeNum}`;
            docUpdates.code = componentCode;
            docUpdated = true;
          }

          // Invariant: Available stock can never exceed totalQuantity or maxAllowed
          if (safeAvailable > total || safeAvailable > maxAllowed) {
            safeAvailable = Math.min(total, maxAllowed);
            docUpdates.availableQuantity = safeAvailable;
            docUpdated = true;
          }

          if (docUpdated) {
            hadDiscrepancy = true;
            docUpdates.updatedAt = Timestamp.now();
            batch.update(docSnap.ref, docUpdates);
          }

          return {
            ...data,
            id: docSnap.id,
            code: componentCode,
            totalQuantity: total,
            availableQuantity: safeAvailable,
            issuedQuantity: issued,
            damagedQuantity: damaged
          } as Component;
        })
        .filter(item => !item.isArchived);

      if (hadDiscrepancy) {
        batch.commit().catch(err => console.warn("Auto-healed inventory stock count/code discrepancy:", err));
      }

      setInventory(invData);
    });

    const codesQuery = query(collection(db, 'project_codes'));
    const unsubscribeCodes = onSnapshot(codesQuery, (snapshot) => {
      const codesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectCode));
      codesData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProjectCodes(codesData);
    }, (error) => {
      console.warn("Error fetching project codes:", error);
    });

    return () => {
      unsubscribeTx();
      unsubscribeInv();
      unsubscribeCodes();
    };
  }, []);

  const handleSeedInventory = async () => {
    if (inventory.length > 0) return alert("Inventory already has items.");
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      const items = [
        { 
          name: 'ESP32 Development Board', 
          category: 'Microcontrollers', 
          description: 'Wi-Fi & Bluetooth Dual-Core MCU with integrated antenna, 30 GPIOs, USB-C interface', 
          qty: 15,
          imageUrl: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=600&auto=format&fit=crop&q=80'
        },
        { 
          name: 'Arduino Uno R3', 
          category: 'Microcontrollers', 
          description: 'ATmega328P based microcontroller board with 14 digital I/O pins, 6 analog inputs', 
          qty: 20,
          imageUrl: 'https://images.unsplash.com/photo-1608564697071-ddf911d81370?w=600&auto=format&fit=crop&q=80'
        },
        { 
          name: 'Raspberry Pi 4 Model B', 
          category: 'SBC', 
          description: '4GB RAM quad-core 64-bit microcomputer with Dual 4K Micro-HDMI, Gigabit Ethernet', 
          qty: 5,
          imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80'
        },
        { 
          name: 'DHT22 Digital Sensor', 
          category: 'Sensors', 
          description: 'High-precision calibrated digital temperature & relative humidity sensor module', 
          qty: 30,
          imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80'
        },
        { 
          name: 'Ultrasonic Distance Sensor', 
          category: 'Sensors', 
          description: 'HC-SR04 sonar precision distance sensor with 2cm-400cm non-contact measurement', 
          qty: 25,
          imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'
        },
        { 
          name: 'Motor Driver Shield', 
          category: 'Modules', 
          description: 'L298N dual H-bridge high power stepper & DC motor driver module', 
          qty: 10,
          imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&auto=format&fit=crop&q=80'
        },
      ];

      items.forEach((item, idx) => {
        const docRef = doc(collection(db, 'inventory'));
        batch.set(docRef, {
          id: docRef.id,
          code: `IIC-C${idx + 1}`,
          name: item.name,
          category: item.category,
          description: item.description,
          imageUrl: item.imageUrl || '',
          totalQuantity: item.qty,
          availableQuantity: item.qty,
          issuedQuantity: 0,
          lowStockThreshold: 2,
          isArchived: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert("Failed to seed inventory");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const batch = writeBatch(db);
      const docRef = doc(collection(db, 'inventory'));
      const assignedCode = newComponent.code?.trim().toUpperCase() || computeNextComponentCode(inventory);

      batch.set(docRef, {
        id: docRef.id,
        code: assignedCode,
        name: newComponent.name,
        category: newComponent.category,
        description: newComponent.description,
        imageUrl: newComponent.imageUrl || '',
        totalQuantity: Number(newComponent.quantity),
        availableQuantity: Number(newComponent.quantity),
        issuedQuantity: 0,
        lowStockThreshold: Number(newComponent.threshold),
        isArchived: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      await batch.commit();
      setShowAddModal(false);
      setNewComponent({ code: '', name: '', category: 'Microcontrollers', description: '', quantity: 1, threshold: 2, imageUrl: '' });
    } catch {
      alert("Error adding component");
    }
  };

  const handleEditComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editComponent) return;
    try {
      const batch = writeBatch(db);
      const docRef = doc(db, 'inventory', editComponent.id);
      
      const newTotal = Math.max(1, Number(editComponent.totalQuantity));
      const currentItem = inventory.find(i => i.id === editComponent.id);
      const currentIssued = Math.max(0, currentItem?.issuedQuantity || 0);
      const currentDamaged = Math.max(0, currentItem?.damagedQuantity || 0);
      
      // Calculate intended available quantity
      const inputAvailable = editComponent.availableQuantity !== undefined
        ? Number(editComponent.availableQuantity)
        : (currentItem?.availableQuantity || 0);

      // Invariant: Available can never exceed totalQuantity and cannot exceed (total - issued - damaged)
      const maxAllowed = Math.max(0, newTotal - currentIssued - currentDamaged);
      const safeAvailable = Math.max(0, Math.min(newTotal, Math.min(maxAllowed, inputAvailable)));

      batch.update(docRef, {
        code: editComponent.code?.trim().toUpperCase() || '',
        name: editComponent.name,
        category: editComponent.category,
        description: editComponent.description,
        imageUrl: editComponent.imageUrl || '',
        totalQuantity: newTotal,
        availableQuantity: safeAvailable,
        lowStockThreshold: Number(editComponent.lowStockThreshold),
        updatedAt: Timestamp.now()
      });
      await batch.commit();
      setShowEditModal(false);
      setEditComponent(null);
    } catch {
      alert("Error updating component");
    }
  };

  const isOverdue = (date: any) => {
    if (!date) return false;
    const returnDate = date.toDate ? date.toDate() : new Date(date.seconds * 1000);
    return new Date() > returnDate;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutData.component) return;
    try {
      const q = query(collection(db, 'users'), where('regNumber', '==', checkoutData.regNumber.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) return alert("Student with specified Registration Number was not found!");
      const student = snap.docs[0].data();

      if (checkoutData.component.availableQuantity < checkoutData.quantity) return alert("Not enough available stock!");

      const batch = writeBatch(db);
      const txRef = doc(collection(db, 'transactions'));
      const expectedReturn = new Date();
      expectedReturn.setDate(expectedReturn.getDate() + checkoutData.days);
      
      batch.set(txRef, {
        id: txRef.id,
        componentId: checkoutData.component.id,
        componentCode: checkoutData.component.code || '',
        componentName: checkoutData.component.name,
        studentId: student.uid,
        studentName: student.name,
        studentRegNumber: student.regNumber,
        studentEmail: student.email || '',
        studentMobile: student.mobileNumber || '',
        studentCode: student.studentCode || '',
        quantity: checkoutData.quantity,
        status: 'Checked Out',
        issueDate: Timestamp.now(),
        expectedReturnDate: Timestamp.fromDate(expectedReturn)
      });

      const compRef = doc(db, 'inventory', checkoutData.component.id);
      batch.update(compRef, {
        availableQuantity: checkoutData.component.availableQuantity - checkoutData.quantity,
        issuedQuantity: checkoutData.component.issuedQuantity + checkoutData.quantity
      });

      await batch.commit();
      setShowCheckoutModal(false);

      // Automated email notification to admin upon issuance with complete student details
      notifyAdminOnIssue({
        studentName: student.name,
        studentRegNumber: student.regNumber,
        studentEmail: student.email,
        studentMobile: student.mobileNumber,
        studentCode: student.studentCode,
        componentCode: checkoutData.component.code,
        componentName: checkoutData.component.name,
        category: checkoutData.component.category,
        quantity: checkoutData.quantity,
        issueDate: new Date(),
        dueDate: expectedReturn,
        adminName: profile?.name || 'Lab Admin',
        transactionId: txRef.id
      }).catch(err => console.warn("Checkout email alert error:", err));
    } catch {
      alert("Error processing checkout");
    }
  };

  // Metrics
  const activeTransactions = transactions.filter(t => t.status !== 'Returned');
  const overdueCount = activeTransactions.filter(t => t.status === 'Overdue' || isOverdue(t.expectedReturnDate)).length;
  const availableUnits = inventory.reduce((a, b) => a + b.availableQuantity, 0);
  const issuedUnits = inventory.reduce((a, b) => a + b.issuedQuantity, 0);

  // Filtered inventory
  const categories = Array.from(new Set(inventory.map(i => i.category).filter(Boolean)));
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'in_stock') return item.availableQuantity > 0;
    if (categoryFilter === 'low_stock') return item.availableQuantity <= item.lowStockThreshold;
    return item.category.toLowerCase() === categoryFilter.toLowerCase();
  });

  const getComponentIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'microcontrollers':
      case 'sbc':
        return <Cpu className="w-5 h-5 text-slate-700" />;
      case 'sensors':
        return <Radio className="w-5 h-5 text-slate-700" />;
      case 'modules':
        return <Layers className="w-5 h-5 text-slate-700" />;
      default:
        return <Boxes className="w-5 h-5 text-slate-700" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <div className="w-9 h-9 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 font-sans">
      {/* 1. TOP WELCOME CARD (Exact Reference UI Style for Vinner Lab) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100/90 text-slate-700 border border-slate-200/80 mb-3.5">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-900 font-bold">Vinner Lab</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 font-normal">Admin Management Console</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Welcome back, {profile?.name || 'Administrator'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            Manage laboratory hardware inventory, issue components to students, monitor active checkouts, and process returns.
          </p>

          {/* TWO BUTTONS BELOW WELCOME BACK */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 mt-4 pt-3.5 border-t border-slate-100">
            <button 
              onClick={() => setShowGenerateCodeModal(true)}
              className="px-4 sm:px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Generate Code
            </button>

            <button 
              onClick={() => {
                setSearchModalInitialCode('');
                setShowSearchCodeModal(true);
              }}
              className="px-4 sm:px-5 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200/90 text-xs sm:text-sm font-bold shadow-2xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Search className="w-4 h-4 text-indigo-600" />
              Search Code
            </button>

            <button 
              onClick={() => {
                setShowIssueToStudentModal(true);
              }}
              className="px-4 sm:px-5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200/90 text-xs sm:text-sm font-bold shadow-2xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Issue to Student
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {inventory.length === 0 && (
            <button 
              onClick={handleSeedInventory} 
              disabled={isSeeding}
              className="px-4 py-2.5 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all shadow-2xs w-full sm:w-auto text-center"
            >
              {isSeeding ? 'Seeding...' : 'Seed Sample Catalog'}
            </button>
          )}

          <button 
            onClick={() => navigate('/admin/scan')}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-full px-5 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-all hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap cursor-pointer w-full sm:w-auto"
          >
            <QrCode className="w-4 h-4 text-slate-700 shrink-0" />
            Scan Return QR
          </button>

          <button 
            onClick={handleOpenAddModal}
            className="bg-black hover:bg-neutral-800 text-white rounded-full px-5 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            Add Lab Component
          </button>
        </div>
      </div>

      {deleteSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setDeleteSuccessMsg('')} 
            className="text-emerald-500 hover:text-emerald-800 p-1 rounded-lg transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. STAT SUMMARY CARDS (Exact Reference UI Card Format) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL COMPONENTS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">TOTAL INVENTORY</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{inventory.length}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60 flex items-center justify-center">
            <Package className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 2: AVAILABLE UNITS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 tracking-wider uppercase">AVAILABLE UNITS</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">{availableUnits}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-500 border border-emerald-200/60 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 3: CURRENTLY ISSUED */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">CURRENTLY ISSUED</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{issuedUnits}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 4: OVERDUE RETURNS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-rose-600 tracking-wider uppercase">OVERDUE RETURNS</p>
            <p className={`text-3xl font-extrabold mt-1 ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{overdueCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center">
            <AlertTriangle className={`w-5 h-5 stroke-[1.75] ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
        </div>
      </div>

      {/* NAVIGATION PILL TABS */}
      <div className="flex items-center gap-2 pt-2 border-b border-slate-200/80 pb-3 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        <button 
          onClick={() => setActiveTab('inventory')} 
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5", 
            activeTab === 'inventory' 
              ? "bg-slate-900 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <Cpu className="w-3.5 h-3.5" />
          Hardware Inventory ({inventory.length})
        </button>
        <button 
          onClick={() => setActiveTab('project_codes')} 
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5", 
            activeTab === 'project_codes' 
              ? "bg-slate-900 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <QrCode className="w-3.5 h-3.5 text-indigo-500" />
          Project Codes ({projectCodes.length})
        </button>
        <button 
          onClick={() => setActiveTab('transactions')} 
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap", 
            activeTab === 'transactions' 
              ? "bg-slate-900 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          Active Checkouts ({activeTransactions.length})
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap", 
            activeTab === 'history' 
              ? "bg-slate-900 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          Audit History
        </button>
        <button 
          onClick={() => setActiveTab('mail')} 
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5", 
            activeTab === 'mail' 
              ? "bg-slate-900 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <Mail className="w-3.5 h-3.5 text-rose-500" />
          Mail Alerts
        </button>
      </div>

      {/* TAB 1: HARDWARE INVENTORY (Exact Reference UI 2-Column Cards Grid) */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Lab Hardware Inventory</h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage component stock, threshold limits, and student issuances</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Bar matching Reference UI */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search components..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-full bg-white border border-slate-200/90 pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black focus:border-black w-60 sm:w-64 shadow-2xs text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Filter Pills matching Reference UI */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-slate-200/80 shadow-2xs overflow-x-auto max-w-full">
                <button 
                  onClick={() => setCategoryFilter('all')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${categoryFilter === 'all' ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All Items
                </button>
                <button 
                  onClick={() => setCategoryFilter('in_stock')}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${categoryFilter === 'in_stock' ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  In Stock
                </button>
                <button 
                  onClick={() => setCategoryFilter('low_stock')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${categoryFilter === 'low_stock' ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Low Stock
                </button>
                {categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${categoryFilter.toLowerCase() === cat.toLowerCase() ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInventory.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200/80">
                <p className="text-slate-500 text-sm">No hardware components found matching your search query.</p>
              </div>
            ) : (
              filteredInventory.map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 overflow-hidden flex items-center justify-center flex-shrink-0 text-slate-700">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            getComponentIcon(item.category)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900 leading-tight">{item.name}</h3>
                            {item.code && (
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/90 shadow-2xs">
                                {item.code}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">Category: {item.category} • Rack-{item.category.slice(0, 3).toUpperCase()}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          item.availableQuantity > item.lowStockThreshold
                            ? 'border-emerald-300 bg-emerald-50/60 text-emerald-600'
                            : item.availableQuantity > 0
                            ? 'border-amber-300 bg-amber-50/60 text-amber-600'
                            : 'border-rose-300 bg-rose-50/60 text-rose-600'
                        }`}>
                          {item.availableQuantity > 0 ? `${item.availableQuantity} available` : 'Out of stock'}
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-slate-200/80 bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      {item.description || 'Hardware resource registered in Vinner Lab inventory.'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>Available: <strong className="font-bold text-slate-900">{item.availableQuantity}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Issued: <strong className="font-semibold text-slate-700">{item.issuedQuantity}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Total: <strong className="font-semibold text-slate-700">{item.totalQuantity}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Threshold: <strong className="font-semibold text-slate-700">{item.lowStockThreshold}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button 
                      onClick={() => { setCheckoutData({ component: item, regNumber: '', quantity: 1, days: 7 }); setShowCheckoutModal(true); }}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                    >
                      Issue to Student
                    </button>
                    <button 
                      onClick={() => { setEditComponent(item); setShowEditModal(true); }}
                      className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => setComponentToDelete(item)}
                      className="p-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                      title={`Delete ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: PROJECT CODES (Team Hardware Authorizations) */}
      {activeTab === 'project_codes' && (
        <div className="space-y-4">
          {/* Success Banner if Team Deleted */}
          {deleteSuccessMsg && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{deleteSuccessMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Supervised Project Authorization Codes</h2>
              <p className="text-xs text-slate-500 mt-0.5">Faculty guides & registered student teams eligible for hardware loan checkouts</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGenerateCodeModal(true)}
                className="px-4 py-2 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Generate New Code
              </button>
              <button
                onClick={() => {
                  setSearchModalInitialCode('');
                  setShowSearchCodeModal(true);
                }}
                className="px-4 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                Search & Issue Hardware
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {projectCodes.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
                <Package className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-extrabold text-slate-900 text-base">No Project Codes Generated Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click "Generate Code" to create a new authorization code with verified Faculty & Students.
                </p>
                <button
                  onClick={() => setShowGenerateCodeModal(true)}
                  className="mt-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Generate First Code
                </button>
              </div>
            ) : (
              projectCodes.map((pc) => (
                <div key={pc.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-extrabold text-slate-900 tracking-wider">
                            {pc.code}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                            {pc.codeType || (pc.code.startsWith('FSV') ? 'FSV' : 'SSV')}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          AY {pc.academicYear} • Registered on {pc.createdAt ? new Date(pc.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSearchModalInitialCode(pc.code);
                            setShowSearchCodeModal(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Package className="w-3.5 h-3.5 text-emerald-300" />
                          Issue Hardware
                        </button>
                        <button
                          onClick={() => setTeamToDelete(pc)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200/80 hover:border-red-200 transition-all cursor-pointer flex items-center justify-center"
                          title="Delete Project Team"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Faculty Details */}
                    <div className="space-y-1.5">
                      {([pc.faculty, pc.faculty2].filter(Boolean) as ProjectFaculty[]).map((fac, fIdx) => (
                        <div key={fIdx} className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                {pc.faculty2 ? `Faculty Advisor #${fIdx + 1}` : 'Faculty Advisor'}
                              </span>
                              <span className="font-bold text-slate-900">{fac.name}</span>
                            </div>
                          </div>
                          <div className="text-right text-[11px] font-mono text-slate-500">
                            <p>ID: {fac.employeeId}</p>
                            <p>📞 {fac.mobileNumber}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Students List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          Student Team ({pc.students.length})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {pc.students.map((student, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/50 text-xs">
                            <p className="font-bold text-slate-800 leading-tight">{student.name}</p>
                            <p className="font-mono text-[10px] text-slate-500 mt-0.5">{student.regNumber}</p>
                            {student.mobileNumber && (
                              <p className="font-mono text-[10px] text-slate-400">📞 {student.mobileNumber}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Issued Hardware Summary under this code */}
                    {pc.issuedItems && pc.issuedItems.length > 0 ? (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Issued Components ({pc.issuedItems.length})
                        </span>
                        <div className="space-y-1.5">
                          {pc.issuedItems.map((item, itemIdx) => {
                            const status = getDueDateStatus(item.expectedReturnDate);
                            return (
                              <div key={itemIdx} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <div>
                                  <strong className="text-slate-900">{item.componentName}</strong>
                                  <span className="text-slate-500 ml-1">x{item.quantity} (collected by {item.collectedByStudentName})</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  status.isOverdue ? 'bg-rose-100 text-rose-700' : status.isNearing ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {status.isOverdue ? 'Overdue' : `Due ${status.formattedDate}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic pt-2 border-t border-slate-100">
                        No hardware components issued under this code yet.
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE CHECKOUTS */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Hardware Checkouts</h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time custody tracking for hardware loaned to students</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTransactions.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200/80">
                <p className="text-slate-500 text-sm">No active hardware checkouts currently logged.</p>
              </div>
            ) : (
              activeTransactions.map(tx => {
                const overdue = tx.status === 'Overdue' || isOverdue(tx.expectedReturnDate);
                return (
                  <div key={tx.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900">{tx.componentName}</h3>
                            {tx.componentCode && (
                              <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                {tx.componentCode}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center flex-wrap gap-1">
                            <span>Student: <strong className="text-slate-800">{tx.studentName}</strong> ({tx.studentRegNumber})</span>
                            {tx.studentCode && (
                              <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                {tx.studentCode}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          overdue 
                            ? 'border-rose-300 bg-rose-50 text-rose-700' 
                            : 'border-amber-300 bg-amber-50 text-amber-700'
                        }`}>
                          {overdue ? 'Overdue' : 'Checked Out'}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>Quantity: <strong className="text-slate-900">{tx.quantity} unit(s)</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Issued: {tx.issueDate ? new Date(tx.issueDate.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                        <span className="text-slate-300">•</span>
                        <span className={overdue ? 'text-rose-600 font-bold' : 'text-slate-700 font-semibold'}>
                          Due: {tx.expectedReturnDate ? new Date(tx.expectedReturnDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => navigate(`/admin/return-loan?id=${tx.id}`)}
                      className="w-full mt-4 py-2 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Process Hardware Return
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-1">Hardware Return History</h2>
          <p className="text-xs text-slate-500 mb-6">Historical record of completed checkouts and verified returns</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Student</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Component</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Qty</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Returned Date</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.filter(t => t.status === 'Returned').length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No return history records yet.</td></tr>
                ) : transactions.filter(t => t.status === 'Returned').map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900">{tx.studentName}</p>
                      <p className="text-[10px] text-slate-400">{tx.studentRegNumber}</p>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{tx.componentName}</span>
                        {tx.componentCode && (
                          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                            {tx.componentCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-semibold">{tx.quantity}</td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">
                      {tx.returnDate ? new Date(tx.returnDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-300 bg-emerald-50 text-emerald-700">
                        Returned
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: MAIL ALERTS & NOTIFICATIONS */}
      {activeTab === 'mail' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Automated Email Notifications</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure recipient address and delivery preferences for automated hardware issuance and return alerts
            </p>
          </div>

          {emailSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{emailSuccessMsg}</span>
              </div>
              <button onClick={() => setEmailSuccessMsg('')} className="text-emerald-500 hover:text-emerald-800 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Connected Webhook Status Banner */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Google Mail Relay Active</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Connected & Verified
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated notifications dispatched directly from your designated Google account.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTriggerTestEmail}
              disabled={isSendingTestEmail}
              className="px-4 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200/90 text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isSendingTestEmail ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending Test...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Send Test Email</span>
                </>
              )}
            </button>
          </div>

          {/* Test Feedback banner */}
          {testEmailFeedback && (
            <div className={`p-4 rounded-2xl text-xs font-medium border flex items-center gap-2 ${
              testEmailFeedback.success 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : 'bg-red-50 text-red-900 border-red-200'
            }`}>
              {testEmailFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{testEmailFeedback.message}</span>
            </div>
          )}

          {/* Configuration Form Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
            <form onSubmit={handleSaveEmailConfig} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Admin Recipient Email Address</span>
                  <span className="text-[10px] text-slate-400 font-normal">Custom address for lab alerts</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="email"
                    value={emailConfig.recipientEmail}
                    onChange={(e) => setEmailConfig({ ...emailConfig, recipientEmail: e.target.value })}
                    placeholder="e.g. vinnerlabiic@gmail.com, hod_ece@college.edu"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  This can be any email ID you choose (does not have to match your login credentials). All issuance and return alerts will be delivered here.
                </p>
              </div>

              {/* Google Apps Script Relay Engine - Hidden URL with Clean Status */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Google Apps Script Relay Engine</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                          Active & Connected
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Automated institutional email dispatch powered by Google Apps Script relay.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedWebhook(prev => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                  >
                    <span>{showAdvancedWebhook ? 'Hide Endpoint URL' : 'Configure Endpoint (Advanced)'}</span>
                    {showAdvancedWebhook ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Collapsed by default: reveals input only when clicked */}
                {showAdvancedWebhook && (
                  <div className="pt-3 border-t border-slate-200/80 animate-in fade-in duration-150 space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Google Apps Script Webhook URL</span>
                      <span className="text-[10px] text-slate-400 font-normal">Advanced Endpoint</span>
                    </label>
                    <input
                      required
                      type="url"
                      value={emailConfig.webhookUrl}
                      onChange={(e) => setEmailConfig({ ...emailConfig, webhookUrl: e.target.value })}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <p className="text-[11px] text-slate-400">
                      Your deployed Google Web App script URL that executes the Gmail delivery relay.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Automated Event Triggers
                </span>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/60 border border-slate-200/80 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={emailConfig.enableOnIssue}
                    onChange={(e) => setEmailConfig({ ...emailConfig, enableOnIssue: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-black focus:ring-black cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Hardware Issuance Alerts
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Sends an executive email summary with full student profile (Name, Reg No, Student Code, Email, Mobile, Project Code), component code, quantity, and due date whenever items are issued.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/60 border border-slate-200/80 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={emailConfig.enableOnReturn}
                    onChange={(e) => setEmailConfig({ ...emailConfig, enableOnReturn: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-black focus:ring-black cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Hardware Return Alerts
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Sends an official return verification receipt with returning student details, condition evaluation (Good/Damaged/Incomplete), and inspector notes upon verification.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSavingEmailConfig}
                  className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEmailConfig ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving Settings...</span>
                    </>
                  ) : (
                    <span>Save Configuration</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Email Previews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Official Dispatch: Hardware Issued</h4>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Automated
                </span>
              </div>
              <div className="text-xs space-y-1.5 text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <p><strong>Subject:</strong> [Vinner Lab] Hardware Issued — [IIC-C1] ESP32-S3 Dev Board to Student Name (21BCE1001)</p>
                <div className="pt-2 border-t border-slate-200/70 space-y-1 text-[11px]">
                  <p>&bull; <strong>Component:</strong> [IIC-C1] ESP32-S3 Dev Board (Qty: 2 units)</p>
                  <p>&bull; <strong>Student:</strong> Student Full Name &bull; Reg: 21BCE1001</p>
                  <p>&bull; <strong>Student ID Code:</strong> IIC2026-27-0001</p>
                  <p>&bull; <strong>Contact:</strong> student@college.edu &bull; 📞 +91 98765 43210</p>
                  <p>&bull; <strong>Project Code:</strong> SSV2026-27-0001 (Faculty: Dr. A. Sharma)</p>
                  <p>&bull; <strong>Due Date:</strong> Scheduled Return in 60 Days</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Official Receipt: Hardware Returned</h4>
                </div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Automated
                </span>
              </div>
              <div className="text-xs space-y-1.5 text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <p><strong>Subject:</strong> [Vinner Lab] Hardware Return Verified — [IIC-C1] ESP32-S3 Dev Board (2 units, Condition: Good)</p>
                <div className="pt-2 border-t border-slate-200/70 space-y-1 text-[11px]">
                  <p>&bull; <strong>Returned Component:</strong> [IIC-C1] ESP32-S3 Dev Board</p>
                  <p>&bull; <strong>Returned Quantity:</strong> 2 unit(s) verified & restocked</p>
                  <p>&bull; <strong>Physical Condition:</strong> ✓ Good (Verified & Functional)</p>
                  <p>&bull; <strong>Student:</strong> Student Full Name (Reg: 21BCE1001 &bull; IIC2026-27-0001)</p>
                  <p>&bull; <strong>Contact:</strong> student@college.edu &bull; 📞 +91 98765 43210</p>
                  <p>&bull; <strong>Inspector Notes:</strong> "All pins intact, verified functional."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD COMPONENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Add Lab Component</h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddComponent} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Component Name</label>
                <input required type="text" placeholder="e.g. ESP32-S3 Dev Board" value={newComponent.name} onChange={e => setNewComponent({...newComponent, name: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Component Code</span>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">Auto</span>
                  </label>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. IIC-C1" 
                    value={newComponent.code} 
                    onChange={e => setNewComponent({...newComponent, code: e.target.value.toUpperCase()})} 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/30 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600" 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Format: IIC-C1 (C = Component)</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Category</label>
                  <input required type="text" placeholder="Microcontrollers, Sensors" value={newComponent.category} onChange={e => setNewComponent({...newComponent, category: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Initial Units</label>
                  <input required type="number" min="1" value={newComponent.quantity} onChange={e => setNewComponent({...newComponent, quantity: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Low Stock Threshold</label>
                  <input required type="number" min="0" value={newComponent.threshold} onChange={e => setNewComponent({...newComponent, threshold: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description & Specifications</label>
                <textarea rows={2} value={newComponent.description} onChange={e => setNewComponent({...newComponent, description: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <ImageUploadField
                value={newComponent.imageUrl}
                onChange={(url) => setNewComponent(prev => ({ ...prev, imageUrl: url }))}
                label="Component Photo"
                helperText="Upload hardware photo or paste image link. Displays on Explore & catalog."
              />
              <div className="pt-2 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-neutral-800 shadow-sm cursor-pointer">Save Component</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT COMPONENT */}
      {showEditModal && editComponent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Edit Component</h3>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditComponent} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Name</label>
                <input required type="text" value={editComponent.name} onChange={e => setEditComponent({...editComponent, name: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Component Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. IIC-C1" 
                    value={editComponent.code || ''} 
                    onChange={e => setEditComponent({...editComponent, code: e.target.value.toUpperCase()})} 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/30 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600" 
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Official Code: IIC-C1 (C = Component)</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Category</label>
                  <input required type="text" value={editComponent.category} onChange={e => setEditComponent({...editComponent, category: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Total Quantity</label>
                  <input 
                    required 
                    type="number" 
                    min="1" 
                    value={editComponent.totalQuantity} 
                    onChange={e => {
                      const newTot = Math.max(1, Number(e.target.value));
                      setEditComponent({
                        ...editComponent, 
                        totalQuantity: newTot,
                        availableQuantity: Math.min(newTot, editComponent.availableQuantity)
                      });
                    }} 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Available Stock (In Lab)</label>
                  <input 
                    required 
                    type="number" 
                    min="0" 
                    max={editComponent.totalQuantity} 
                    value={Math.min(editComponent.totalQuantity, editComponent.availableQuantity ?? editComponent.totalQuantity)} 
                    onChange={e => {
                      const val = Number(e.target.value);
                      setEditComponent({
                        ...editComponent, 
                        availableQuantity: Math.min(editComponent.totalQuantity, Math.max(0, val))
                      });
                    }} 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" 
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Cannot exceed Total ({editComponent.totalQuantity})</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Low Stock Threshold</label>
                <input required type="number" min="0" value={editComponent.lowStockThreshold} onChange={e => setEditComponent({...editComponent, lowStockThreshold: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description</label>
                <textarea rows={2} value={editComponent.description} onChange={e => setEditComponent({...editComponent, description: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <ImageUploadField
                value={editComponent.imageUrl}
                onChange={(url) => setEditComponent(prev => prev ? ({ ...prev, imageUrl: url }) : null)}
                label="Component Photo"
                helperText="Upload replacement hardware photo or update link."
              />
              <div className="pt-2 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-neutral-800 shadow-sm cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ISSUE / CHECKOUT TO STUDENT */}
      {showCheckoutModal && checkoutData.component && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Issue Hardware</h3>
                <p className="text-xs text-slate-500">{checkoutData.component.name}</p>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCheckout} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Student Registration Number</label>
                <input required type="text" placeholder="e.g. 21BCE1042" value={checkoutData.regNumber} onChange={e => setCheckoutData({...checkoutData, regNumber: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Quantity</label>
                  <input required type="number" min="1" max={checkoutData.component.availableQuantity} value={checkoutData.quantity} onChange={e => setCheckoutData({...checkoutData, quantity: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Loan Duration (Days)</label>
                  <input required type="number" min="1" max="90" value={checkoutData.days} onChange={e => setCheckoutData({...checkoutData, days: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-500">
                Available stock for loan: <strong className="text-slate-900">{checkoutData.component.availableQuantity} units</strong>
              </div>
              <div className="pt-2 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowCheckoutModal(false)} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-neutral-800 shadow-sm cursor-pointer">Confirm Checkout</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: GENERATE PROJECT CODE */}
      <GenerateCodeModal
        isOpen={showGenerateCodeModal}
        onClose={() => setShowGenerateCodeModal(false)}
        onCodeCreated={(_newCode) => {
          // Switch to project_codes tab to see newly created code
          setActiveTab('project_codes');
        }}
      />

      {/* MODAL 5: SEARCH CODE & ISSUE HARDWARE */}
      <SearchCodeModal
        isOpen={showSearchCodeModal}
        onClose={() => setShowSearchCodeModal(false)}
        inventory={inventory}
        initialCode={searchModalInitialCode}
        onComponentIssued={() => {
          // Handled via Firestore onSnapshot
        }}
      />

      {/* MODAL 5B: ISSUE HARDWARE DIRECTLY TO STUDENT (NON-SSV/FSV) */}
      <IssueToStudentModal
        isOpen={showIssueToStudentModal}
        onClose={() => setShowIssueToStudentModal(false)}
        inventory={inventory}
        transactions={transactions}
        onComponentIssued={() => {
          // Handled via Firestore onSnapshot
        }}
      />

      {/* MODAL 6: NOTIFICATIONS */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />

      {/* MODAL 7: DELETE TEAM CONFIRMATION */}
      {teamToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Delete Project Team</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{teamToDelete.code}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Code Type:</span>
                <span className="font-bold font-mono text-slate-900">{teamToDelete.codeType || (teamToDelete.code.startsWith('FSV') ? 'FSV' : 'SSV')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Faculty Guide{teamToDelete.faculty2 ? 's' : ''}:</span>
                <span className="font-bold text-slate-900 text-right">
                  {([teamToDelete.faculty, teamToDelete.faculty2].filter(Boolean) as ProjectFaculty[]).map(f => `${f.name} (${f.employeeId})`).join(' & ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Student Team:</span>
                <span className="font-bold text-slate-900">{teamToDelete.students.length} student(s)</span>
              </div>
              {teamToDelete.issuedItems && teamToDelete.issuedItems.length > 0 && (
                <div className="pt-2 border-t border-amber-200 text-amber-800 bg-amber-50 p-2.5 rounded-xl font-medium text-[11px] flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Warning: There are currently {teamToDelete.issuedItems.length} hardware component(s) checked out under this project code.
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this team? This action will remove the authorization code and student/faculty team registrations.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setTeamToDelete(null)}
                disabled={isDeletingTeam}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTeam}
                disabled={isDeletingTeam}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingTeam ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Team
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 8: DELETE COMPONENT CONFIRMATION */}
      {componentToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Delete Component</h3>
                <p className="text-xs text-slate-500 mt-0.5">{componentToDelete.name}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-bold text-slate-900">{componentToDelete.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Quantity:</span>
                <span className="font-bold text-slate-900">{componentToDelete.totalQuantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Currently Issued:</span>
                <span className="font-bold text-slate-900">{componentToDelete.issuedQuantity || 0} units</span>
              </div>
              {(componentToDelete.issuedQuantity || 0) > 0 && (
                <div className="pt-2 border-t border-amber-200 text-amber-800 bg-amber-50 p-2.5 rounded-xl font-medium text-[11px] flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Notice: There are currently {componentToDelete.issuedQuantity} unit(s) checked out to students. Deleting will remove it from new checkouts while preserving active loan tracking.
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this component from Vinner Lab inventory? It will no longer appear in the catalog or checkout list.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setComponentToDelete(null)}
                disabled={isDeletingComponent}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteComponent}
                disabled={isDeletingComponent}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingComponent ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Component
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
