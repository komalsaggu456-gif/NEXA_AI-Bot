import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { db, auth, hasConfiguredFirebase, ensureAuth, getStableGuestId, handleFirestoreError, OperationType } from '../firebase';

export interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  panel?: any;
  initialData?: Record<string, unknown>;
  timestamp: Date;
  isJcStep?: boolean;
  jcStepCode?: string;
}

export interface ChatSession {
  id: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  chatType?: "work" | "employee";
  isCompleted?: boolean;
}

// Check if Firebase is active and initialized correctly
export function isFirebaseEnabled() {
  return hasConfiguredFirebase && auth !== null && db !== null;
}

// LocalStorage helpers to secure session state and message history
function getLocalSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("nexa_local_sessions");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return arr.map((item: any) => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt)
    }));
  } catch (e) {
    console.error("Failed to parse local sessions:", e);
    return [];
  }
}

function saveLocalSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("nexa_local_sessions", JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save local sessions:", e);
  }
}

function getLocalMessages(sessionId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`nexa_local_msg_${sessionId}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return arr.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp)
    }));
  } catch (e) {
    console.error("Failed to parse local messages:", e);
    return [];
  }
}

function saveLocalMessages(sessionId: string, messages: Message[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`nexa_local_msg_${sessionId}`, JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save local messages:", e);
  }
}

// 1. Fetch all chat sessions for the current authenticated user or guest fallback
export async function fetchChatSessions(): Promise<ChatSession[]> {
  if (!isFirebaseEnabled()) {
    return getLocalSessions().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  const user = await ensureAuth();
  const userId = user ? user.uid : getStableGuestId();

  const path = 'chat_sessions';
  try {
    const q = query(
      collection(db, path), 
      where("userId", "==", userId),
      orderBy("updatedAt", "desc")
    );
    const snap = await getDocs(q);
    const sessions: ChatSession[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      sessions.push({
        id: data.id,
        label: data.label,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        userId: data.userId,
        chatType: data.chatType || "work",
        isCompleted: data.isCompleted || false,
      });
    });
    return sessions;
  } catch (err) {
    console.warn("Firestore fetch failed, falling back to localStorage:", err);
    return getLocalSessions().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}

// 2. Fetch all messages for a specific session
export async function fetchChatMessages(sessionId: string): Promise<Message[]> {
  if (!isFirebaseEnabled()) {
    return getLocalMessages(sessionId);
  }
  await ensureAuth();

  const path = `chat_sessions/${sessionId}/messages`;
  try {
    const q = query(collection(db, path), orderBy("timestamp", "asc"));
    const snap = await getDocs(q);
    const messages: Message[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      messages.push({
        id: data.id,
        role: data.role as "user" | "bot",
        text: data.text || "",
        panel: data.panel || undefined,
        initialData: data.initialData?.initialData || data.initialData || undefined,
        timestamp: data.timestamp?.toDate() || new Date(),
        isJcStep: data.isJcStep || undefined,
        jcStepCode: data.jcStepCode || undefined,
      });
    });
    return messages;
  } catch (err) {
    console.warn("Firestore messages fetch failed, falling back to localStorage:", err);
    return getLocalMessages(sessionId);
  }
}

// 3. Create or update session metadata
export async function saveChatSession(sessionId: string, label: string, chatType: "work" | "employee" = "work", isCompleted?: boolean): Promise<void> {
  const now = new Date();
  
  // Save locally first to guarantee persistence
  const localSess = getLocalSessions();
  const existingIdx = localSess.findIndex(s => s.id === sessionId);
  if (existingIdx === -1) {
    localSess.push({
      id: sessionId,
      label: label.substring(0, 80) || "New Conversation",
      createdAt: now,
      updatedAt: now,
      userId: getStableGuestId(),
      chatType,
      isCompleted: isCompleted || false
    });
  } else {
    localSess[existingIdx].label = label.substring(0, 80);
    localSess[existingIdx].updatedAt = now;
    localSess[existingIdx].chatType = chatType;
    if (isCompleted !== undefined) {
      localSess[existingIdx].isCompleted = isCompleted;
    }
  }
  saveLocalSessions(localSess);

  if (!isFirebaseEnabled()) return;
  const user = await ensureAuth();
  const userId = user ? user.uid : getStableGuestId();

  const path = `chat_sessions`;
  try {
    const docRef = doc(db, path, sessionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        id: sessionId,
        label: label.substring(0, 80) || "New Conversation",
        createdAt: now,
        updatedAt: now,
        userId: userId,
        chatType: chatType,
        isCompleted: isCompleted || false,
      });
    } else {
      const updatePayload: any = {
        label: label.substring(0, 80),
        updatedAt: now,
        chatType: chatType,
      };
      if (isCompleted !== undefined) {
        updatePayload.isCompleted = isCompleted;
      }
      await updateDoc(docRef, updatePayload);
    }
  } catch (err) {
    console.warn("Failed to write session to Firestore, saved to local storage:", err);
  }
}

// 4. Save/Update a single message inside a chat session
export async function saveChatMessage(sessionId: string, msg: Message): Promise<void> {
  // Update local message subcollection
  const localMsgs = getLocalMessages(sessionId);
  const existingMsgIdx = localMsgs.findIndex(m => m.id === msg.id);
  if (existingMsgIdx === -1) {
    localMsgs.push(msg);
  } else {
    localMsgs[existingMsgIdx] = msg;
  }
  saveLocalMessages(sessionId, localMsgs);

  // Update touch timestamp of parent local session
  const localSess = getLocalSessions();
  const parentIdx = localSess.findIndex(s => s.id === sessionId);
  if (parentIdx !== -1) {
    localSess[parentIdx].updatedAt = new Date();
    saveLocalSessions(localSess);
  }

  if (!isFirebaseEnabled()) return;
  await ensureAuth();

  const path = `chat_sessions/${sessionId}/messages`;
  try {
    const docRef = doc(db, path, msg.id);
    const payload: any = {
      id: msg.id,
      role: msg.role,
      text: msg.text || "",
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
    };
    if (msg.panel !== undefined) payload.panel = msg.panel;
    if (msg.initialData !== undefined) payload.initialData = msg.initialData;
    if (msg.isJcStep !== undefined) payload.isJcStep = msg.isJcStep;
    if (msg.jcStepCode !== undefined) payload.jcStepCode = msg.jcStepCode;

    await setDoc(docRef, payload);

    // Touch the parent session documents' updatedAt timestamp for clean chronological sorted indexing
    const sessionRef = doc(db, 'chat_sessions', sessionId);
    await updateDoc(sessionRef, {
      updatedAt: new Date(),
    });
  } catch (err) {
    console.warn("Failed to save message to Firestore, saved to local storage:", err);
  }
}

// 5. Use user authorization permissions to delete a session and its subcollection messages
export async function deleteChatSession(sessionId: string): Promise<void> {
  // Delete from local storage
  const localSess = getLocalSessions().filter(s => s.id !== sessionId);
  saveLocalSessions(localSess);
  if (typeof window !== "undefined") {
    localStorage.removeItem(`nexa_local_msg_${sessionId}`);
  }

  if (!isFirebaseEnabled()) return;
  await ensureAuth();

  try {
    const sessionRef = doc(db, 'chat_sessions', sessionId);
    
    // First clear nested subcollection documents
    const messagesPath = `chat_sessions/${sessionId}/messages`;
    const msgsSnap = await getDocs(collection(db, messagesPath));
    const deletePromises: Promise<void>[] = [];
    msgsSnap.forEach((mDoc) => {
      deletePromises.push(deleteDoc(doc(db, messagesPath, mDoc.id)));
    });
    await Promise.all(deletePromises);

    // Then delete parent session document
    await deleteDoc(sessionRef);
  } catch (err) {
    console.warn("Failed to delete from Firestore, removed from local storage:", err);
  }
}
