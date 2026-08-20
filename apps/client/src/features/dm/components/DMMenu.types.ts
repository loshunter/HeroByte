import type {
  Character,
  PlayerStagingZone,
  Prop,
  Player,
  SceneObject,
  SnapshotCharacter,
  DiagonalRule,
  MonsterHpDisplay,
} from "@herobyte/shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../types/alignment";
import type { Camera } from "../../../hooks/useCamera";
import type { CreateNpcRequest } from "../hooks/useNpcCreation";
import type { MapStudioController } from "../../map-studio";

export interface DMMenuProps {
  isDM: boolean;
  onToggleDM: (next: boolean) => void;
  gridSize: number;
  gridSquareSize?: number;
  gridLocked: boolean;
  onGridLockToggle: () => void;
  onGridSizeChange: (size: number) => void;
  onGridSquareSizeChange?: (size: number) => void;
  diagonalRule?: DiagonalRule;
  onDiagonalRuleChange?: (rule: DiagonalRule) => void;
  fogEnabled?: boolean;
  hasCompiledScene?: boolean;
  onFogEnabledChange?: (enabled: boolean) => void;
  defaultVisionRadius?: number;
  onDefaultVisionRadiusChange?: (radiusFeet: number | null) => void;
  onClearDrawings: () => void;
  onSetMapBackground: (url: string) => void;
  mapBackground?: string;
  onMapBackgroundSuccess?: (message: string) => void;
  onMapBackgroundError?: (message: string) => void;
  playerStagingZone?: PlayerStagingZone;
  onSetPlayerStagingZone?: (zone: PlayerStagingZone | undefined) => void;
  stagingZoneLocked?: boolean;
  onStagingZoneLockToggle?: () => void;
  camera: Camera;
  playerCount: number;
  characters: SnapshotCharacter[];
  onRequestSaveSession?: (sessionName: string) => void;
  onRequestLoadSession?: (file: File) => void;
  onCreateNPC: (request?: CreateNpcRequest) => void;
  onUpdateNPC: (id: string, updates: Partial<Character>) => void;
  onDuplicateNPC: (id: string) => void;
  onDeleteNPC: (id: string) => void;
  onPlaceNPCToken: (id: string) => void;
  isCreatingNpc?: boolean;
  npcCreationError?: string | null;
  isUpdatingNpc?: boolean;
  npcUpdateError?: string | null;
  updatingNpcId?: string | null;
  isPlacingToken?: boolean;
  tokenPlacementError?: string | null;
  placingTokenForNpcId?: string | null;
  props: Prop[];
  players: Player[];
  /** Create `count` props in ONE message (scatter); absent means one. */
  onCreateProp: (count?: number) => void;
  onUpdateProp: (id: string, updates: Pick<Prop, "label" | "imageUrl" | "owner" | "size">) => void;
  onDeleteProp: (id: string) => void;
  isCreatingProp?: boolean;
  propCreationError?: string | null;
  isDeletingProp?: boolean;
  deletingPropId?: string | null;
  propDeletionError?: string | null;
  isUpdatingProp?: boolean;
  propUpdateError?: string | null;
  updatingPropId?: string | null;
  mapLocked?: boolean;
  onMapLockToggle?: () => void;
  mapTransform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  onMapTransformChange?: (
    transform: Partial<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  ) => void;
  alignmentModeActive: boolean;
  alignmentPoints: AlignmentPoint[];
  alignmentSuggestion: AlignmentSuggestion | null;
  alignmentError?: string | null;
  onAlignmentStart: () => void;
  onAlignmentReset: () => void;
  onAlignmentCancel: () => void;
  onAlignmentApply: () => void;
  onSetRoomPassword?: (secret?: string) => void;
  roomPasswordStatus?: { type: "success" | "error"; message: string } | null;
  roomPasswordPending?: boolean;
  onDismissRoomPasswordStatus?: () => void;
  /** Test table only: copy this table into a new private one. */
  onSaveAsPrivateTable?: (input: {
    name: string;
    roomPassword: string;
    dmPassword?: string;
  }) => Promise<void>;
  sceneObjects: SceneObject[];
  onSelectPlayerTokens: (playerUid: string) => void;
  combatActive?: boolean;
  monsterHpDisplay?: MonsterHpDisplay;
  onMonsterHpDisplayChange?: (mode: MonsterHpDisplay) => void;
  onStartCombat?: () => void;
  onEndCombat?: () => void;
  onClearAllInitiative?: () => void;
  onNextTurn?: () => void;
  onPreviousTurn?: () => void;
  toast?: {
    success: (message: string) => void;
    error: (message: string) => void;
  };
  onRollAllInitiative?: () => void;
  /** Player-props toggle (Session tab): players may manage their OWN props. */
  playerPropsEnabled?: boolean;
  onPlayerPropsEnabledChange?: (enabled: boolean) => void;
  /**
   * Initiative manual-override toggle (Session tab): players may enter a
   * number by hand instead of rolling. Unlike the flag above this one is ON by
   * default, so the caller derives it with `!== false`.
   */
  initiativeManualOverride?: boolean;
  onInitiativeManualOverrideChange?: (enabled: boolean) => void;
  mapStudio?: MapStudioController;
  /**
   * How the menu presents (M4b). "window" is the desktop shape: the floating
   * 🛠️ DM MENU launcher plus a DraggableWindow. "content" renders ONLY the
   * inner content — exit row, tabs (as a scrollable chip row), active tab —
   * for a host that already provides the surface, like the mobile DM screen.
   */
  presentation?: "window" | "content";
}
