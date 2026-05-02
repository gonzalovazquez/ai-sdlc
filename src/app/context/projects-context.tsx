"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { AgentMessage } from "../hooks/use-agent-stream";
import {
  createProjectStreamManager,
  type StreamEvent,
} from "../hooks/use-project-stream";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Project {
  id: string;
  threadId: string;
  name: string;
  description: string;
  platform: string;
  currentPhase: string;
  status: "running" | "awaiting_approval" | "completed" | "error";
  awaitingApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStreamState {
  messages: AgentMessage[];
  currentPhase: string;
  isStreaming: boolean;
  awaitingApproval: boolean;
  error: string | null;
}

interface ProjectsContextValue {
  projects: Project[];
  activeProjectId: string | null;
  streamStates: Record<string, ProjectStreamState>;
  setActiveProject: (id: string) => void;
  createProject: (data: {
    name: string;
    description: string;
    platform: string;
  }) => Promise<void>;
  sendMessage: (projectId: string, message: string) => void;
  approve: (
    projectId: string,
    approved: boolean,
    feedback?: string
  ) => void;
}

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

type Action =
  | { type: "SET_PROJECTS"; projects: Project[] }
  | { type: "ADD_PROJECT"; project: Project }
  | { type: "SET_ACTIVE"; id: string | null }
  | {
      type: "STREAM_EVENT";
      projectId: string;
      event: StreamEvent;
    }
  | {
      type: "SET_STREAMING";
      projectId: string;
      isStreaming: boolean;
    }
  | {
      type: "HYDRATE_HISTORY";
      projectId: string;
      messages: AgentMessage[];
      currentPhase: string;
      awaitingApproval: boolean;
    }
  | {
      type: "POLL_UPDATE";
      projectId: string;
      currentPhase: string;
      awaitingApproval: boolean;
    }
  | {
      type: "UPDATE_PROJECT";
      projectId: string;
      changes: Partial<Project>;
    };

interface State {
  projects: Project[];
  activeProjectId: string | null;
  streamStates: Record<string, ProjectStreamState>;
}

function defaultStreamState(): ProjectStreamState {
  return {
    messages: [],
    currentPhase: "intake",
    isStreaming: false,
    awaitingApproval: false,
    error: null,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_PROJECTS": {
      const streamStates = { ...state.streamStates };
      for (const p of action.projects) {
        if (!streamStates[p.id]) {
          streamStates[p.id] = {
            ...defaultStreamState(),
            currentPhase: p.currentPhase,
            awaitingApproval: p.awaitingApproval,
          };
        }
      }
      return { ...state, projects: action.projects, streamStates };
    }

    case "ADD_PROJECT": {
      return {
        ...state,
        projects: [action.project, ...state.projects],
        streamStates: {
          ...state.streamStates,
          [action.project.id]: {
            ...defaultStreamState(),
            isStreaming: true,
          },
        },
      };
    }

    case "SET_ACTIVE":
      return { ...state, activeProjectId: action.id };

    case "SET_STREAMING": {
      const prev = state.streamStates[action.projectId] ?? defaultStreamState();
      return {
        ...state,
        streamStates: {
          ...state.streamStates,
          [action.projectId]: {
            ...prev,
            isStreaming: action.isStreaming,
            error: null,
          },
        },
      };
    }

    case "STREAM_EVENT": {
      const prev =
        state.streamStates[action.projectId] ?? defaultStreamState();
      const { event } = action;

      switch (event.type) {
        case "message":
          return {
            ...state,
            streamStates: {
              ...state.streamStates,
              [action.projectId]: {
                ...prev,
                messages: [
                  ...prev.messages,
                  event.data as unknown as AgentMessage,
                ],
              },
            },
          };

        case "phase_change":
          return {
            ...state,
            streamStates: {
              ...state.streamStates,
              [action.projectId]: {
                ...prev,
                currentPhase: event.data.phase as string,
              },
            },
          };

        case "awaiting_approval":
          return {
            ...state,
            streamStates: {
              ...state.streamStates,
              [action.projectId]: {
                ...prev,
                awaitingApproval: true,
                isStreaming: false,
              },
            },
          };

        case "error":
          return {
            ...state,
            streamStates: {
              ...state.streamStates,
              [action.projectId]: {
                ...prev,
                error: event.data.message as string,
                isStreaming: false,
              },
            },
          };

        case "end":
          return {
            ...state,
            streamStates: {
              ...state.streamStates,
              [action.projectId]: {
                ...prev,
                isStreaming: false,
              },
            },
          };

        default:
          return state;
      }
    }

    case "HYDRATE_HISTORY": {
      const prev =
        state.streamStates[action.projectId] ?? defaultStreamState();
      return {
        ...state,
        streamStates: {
          ...state.streamStates,
          [action.projectId]: {
            ...prev,
            messages: action.messages,
            currentPhase: action.currentPhase,
            awaitingApproval: action.awaitingApproval,
          },
        },
      };
    }

    case "POLL_UPDATE": {
      const prev =
        state.streamStates[action.projectId] ?? defaultStreamState();
      if (
        prev.currentPhase === action.currentPhase &&
        prev.awaitingApproval === action.awaitingApproval
      ) {
        return state;
      }
      return {
        ...state,
        streamStates: {
          ...state.streamStates,
          [action.projectId]: {
            ...prev,
            currentPhase: action.currentPhase,
            awaitingApproval: action.awaitingApproval,
          },
        },
      };
    }

    case "UPDATE_PROJECT": {
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, ...action.changes } : p
        ),
      };
    }

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Context & Provider                                                 */
/* ------------------------------------------------------------------ */

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    projects: [],
    activeProjectId: null,
    streamStates: {},
  });

  // Stream manager — created once, dispatches into reducer
  const streamManagerRef = useRef<ReturnType<
    typeof createProjectStreamManager
  > | null>(null);

  if (!streamManagerRef.current) {
    streamManagerRef.current = createProjectStreamManager(
      (projectId, event) => {
        dispatch({ type: "STREAM_EVENT", projectId, event });

        // Sync phase/approval changes back to server
        if (event.type === "phase_change") {
          const proj = stateRef.current.projects.find(
            (p) => p.id === projectId
          );
          if (proj) {
            fetch(`/api/projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPhase: event.data.phase }),
            }).catch(() => {});
          }
        }
        if (event.type === "awaiting_approval") {
          fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              awaitingApproval: true,
              status: "awaiting_approval",
            }),
          }).catch(() => {});
        }
      }
    );
  }

  // Keep a ref to current state for use in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load projects on mount
  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((list: Project[]) => {
        dispatch({ type: "SET_PROJECTS", projects: list });
        if (list.length > 0) {
          dispatch({ type: "SET_ACTIVE", id: list[0].id });
        }
      })
      .catch(() => {});
  }, []);

  // Hydrate history when active project changes and has no messages
  useEffect(() => {
    const { activeProjectId, streamStates, projects } = stateRef.current;
    if (!activeProjectId) return;

    const stream = streamStates[activeProjectId];
    if (stream && stream.messages.length > 0) return;

    const project = projects.find((p) => p.id === activeProjectId);
    if (!project) return;

    fetch(`/api/history?threadId=${project.threadId}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data || !data.messages) return;
        const messages: AgentMessage[] = data.messages.map(
          (m: { role: string; content: string; name?: string }, i: number) => ({
            id: `history-${activeProjectId}-${i}`,
            node: m.name || m.role,
            content: m.content,
            timestamp: Date.now(),
          })
        );
        dispatch({
          type: "HYDRATE_HISTORY",
          projectId: activeProjectId,
          messages,
          currentPhase: data.currentPhase || "intake",
          awaitingApproval: data.awaitingApproval || false,
        });
      })
      .catch(() => {});
  }, [state.activeProjectId]);

  // Background poller — check non-streaming projects every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      const { projects, streamStates } = stateRef.current;
      for (const project of projects) {
        const stream = streamStates[project.id];
        if (stream?.isStreaming) continue;

        fetch(`/api/history?threadId=${project.threadId}`)
          .then((res) => {
            if (!res.ok) return null;
            return res.json();
          })
          .then((data) => {
            if (!data) return;
            dispatch({
              type: "POLL_UPDATE",
              projectId: project.id,
              currentPhase: data.currentPhase || "intake",
              awaitingApproval: data.awaitingApproval || false,
            });
          })
          .catch(() => {});
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, []);

  const setActiveProject = useCallback((id: string) => {
    dispatch({ type: "SET_ACTIVE", id });
  }, []);

  const createProject = useCallback(
    async (data: { name: string; description: string; platform: string }) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const newProject: Project = await res.json();

      dispatch({ type: "ADD_PROJECT", project: newProject });
      dispatch({ type: "SET_ACTIVE", id: newProject.id });

      // Fire and forget — kick off the pipeline without awaiting
      if (data.description) {
        const kickoffMsg = `I want to build a project called "${data.name}". Platform: ${data.platform}. ${data.description}`;
        streamManagerRef.current?.sendMessage(
          newProject.id,
          kickoffMsg,
          newProject.threadId
        );
      }
    },
    []
  );

  const sendMessage = useCallback((projectId: string, message: string) => {
    const project = stateRef.current.projects.find((p) => p.id === projectId);
    if (!project) return;
    dispatch({ type: "SET_STREAMING", projectId, isStreaming: true });
    streamManagerRef.current?.sendMessage(
      projectId,
      message,
      project.threadId
    );
  }, []);

  const approve = useCallback(
    (projectId: string, approved: boolean, feedback?: string) => {
      const project = stateRef.current.projects.find(
        (p) => p.id === projectId
      );
      if (!project) return;
      dispatch({ type: "SET_STREAMING", projectId, isStreaming: true });
      // Clear awaiting_approval on server
      fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awaitingApproval: false,
          status: "running",
        }),
      }).catch(() => {});
      streamManagerRef.current?.approve(
        projectId,
        project.threadId,
        approved,
        feedback
      );
    },
    []
  );

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      streamStates: state.streamStates,
      setActiveProject,
      createProject,
      sendMessage,
      approve,
    }),
    [
      state.projects,
      state.activeProjectId,
      state.streamStates,
      setActiveProject,
      createProject,
      sendMessage,
      approve,
    ]
  );

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) {
    throw new Error("useProjects must be used within a ProjectsProvider");
  }
  return ctx;
}
