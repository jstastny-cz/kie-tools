/*
 * Copyright 2021 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ActiveWorkspace } from "@kie-tools-core/workspaces-git-fs/dist/model/ActiveWorkspace";
import { useWorkspaces, WorkspaceFile } from "@kie-tools-core/workspaces-git-fs/dist/context/WorkspacesContext";
import { useRoutes } from "../navigation/Hooks";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { join } from "path";
import { Dropdown } from "@patternfly/react-core/dist/js/components/Dropdown";
import { Flex, FlexItem } from "@patternfly/react-core/dist/js/layouts/Flex";
import { FileLabel } from "../filesList/FileLabel";
import { Toggle } from "@patternfly/react-core/dist/js/components/Dropdown/Toggle";
import { Title } from "@patternfly/react-core/dist/js/components/Title";
import { Popover } from "@patternfly/react-core/dist/js/components/Popover";
import { Tooltip } from "@patternfly/react-core/dist/js/components/Tooltip";
import { Text, TextVariants } from "@patternfly/react-core/dist/js/components/Text";
import { TextInput } from "@patternfly/react-core/dist/js/components/TextInput";
import { Divider } from "@patternfly/react-core/dist/js/components/Divider";
import {
  DrilldownMenu,
  Menu,
  MenuContent,
  MenuGroup,
  MenuInput,
  MenuItem,
  MenuList,
} from "@patternfly/react-core/dist/js/components/Menu";
import { CaretDownIcon } from "@patternfly/react-icons/dist/js/icons/caret-down-icon";
import { FolderIcon } from "@patternfly/react-icons/dist/js/icons/folder-icon";
import { ImageIcon } from "@patternfly/react-icons/dist/js/icons/image-icon";
import { ThLargeIcon } from "@patternfly/react-icons/dist/js/icons/th-large-icon";
import { ListIcon } from "@patternfly/react-icons/dist/js/icons/list-icon";
import { useWorkspaceDescriptorsPromise } from "@kie-tools-core/workspaces-git-fs/dist/hooks/WorkspacesHooks";
import {
  PromiseState,
  PromiseStateWrapper,
  useCombinedPromiseState,
} from "@kie-tools-core/react-hooks/dist/PromiseState";
import { Split, SplitItem } from "@patternfly/react-core/dist/js/layouts/Split";
import { Button } from "@patternfly/react-core/dist/js/components/Button";
import { useWorkspacesFilesPromise } from "@kie-tools-core/workspaces-git-fs/dist/hooks/WorkspacesFiles";
import { Skeleton } from "@patternfly/react-core/dist/js/components/Skeleton";
import { Card, CardBody, CardHeader, CardHeaderMain } from "@patternfly/react-core/dist/js/components/Card";
import { Gallery } from "@patternfly/react-core/dist/js/layouts/Gallery";
import { useHistory } from "react-router";
import { Bullseye } from "@patternfly/react-core/dist/js/layouts/Bullseye";
import { EmptyState, EmptyStateIcon } from "@patternfly/react-core/dist/js/components/EmptyState";
import { CubesIcon } from "@patternfly/react-icons/dist/js/icons/cubes-icon";
import { useEditorEnvelopeLocator } from "../envelopeLocator/hooks/EditorEnvelopeLocatorContext";
import { VariableSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import {
  FileDataList,
  FileLink,
  FileListItem,
  FileListItemDisplayMode,
  getFileDataListHeight,
  SingleFileWorkspaceDataList,
} from "../filesList/FileDataList";
import {
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
} from "@patternfly/react-core/dist/js/components/DataList";
import { WorkspaceListItem } from "../workspace/components/WorkspaceListItem";
import { usePreviewSvg } from "../previewSvgs/PreviewSvgHooks";
import { WorkspaceLoadingMenuItem } from "../workspace/components/WorkspaceLoadingCard";
import { WorkspaceGitStatusType } from "@kie-tools-core/workspaces-git-fs/dist/hooks/WorkspaceHooks";
import {
  listDeletedFiles,
  resolveGitLocalChangesStatus,
  WorkspaceGitLocalChangesStatus,
} from "../workspace/components/WorkspaceStatusIndicator";
import { switchExpression } from "../switchExpression/switchExpression";
import { WorkspaceDescriptor } from "@kie-tools-core/workspaces-git-fs/dist/worker/api/WorkspaceDescriptor";
import { Checkbox } from "@patternfly/react-core/dist/js/components/Checkbox";
import { SearchInput } from "@patternfly/react-core/dist/js/components/SearchInput";
import { Truncate } from "@patternfly/react-core/dist/js/components/Truncate";

const ROOT_MENU_ID = "rootMenu";

export enum FilesMenuMode {
  LIST,
  CAROUSEL,
}

export const MIN_FILE_SWITCHER_PANEL_WIDTH_IN_PX = 500;
const MAX_NUMBER_OF_CAROUSEL_ITEMS_SHOWN = 40;

export function FileSwitcher(props: {
  workspace: ActiveWorkspace;
  workspaceGitStatusPromise?: PromiseState<WorkspaceGitStatusType>;
  workspaceFile: WorkspaceFile;
  onDeletedWorkspaceFile: () => void;
}) {
  const workspaces = useWorkspaces();
  const workspaceFileNameRef = useRef<HTMLInputElement>(null);
  const [newFileNameValid, setNewFileNameValid] = useState<boolean>(true);

  const resetWorkspaceFileName = useCallback(() => {
    if (workspaceFileNameRef.current) {
      workspaceFileNameRef.current.value = props.workspaceFile.nameWithoutExtension;
      setNewFileNameValid(true);
    }
  }, [props.workspaceFile]);

  const checkNewFileName = useCallback(
    async (newFileNameWithoutExtension: string) => {
      const trimmedNewFileNameWithoutExtension = newFileNameWithoutExtension.trim();
      if (trimmedNewFileNameWithoutExtension === props.workspaceFile.nameWithoutExtension) {
        setNewFileNameValid(true);
        return;
      }

      const newRelativePath = join(
        props.workspaceFile.relativeDirPath,
        `${trimmedNewFileNameWithoutExtension}.${props.workspaceFile.extension}`
      );

      const hasConflictingFileName = await workspaces.existsFile({
        workspaceId: props.workspaceFile.workspaceId,
        relativePath: newRelativePath,
      });

      const hasForbiddenCharacters = !/^[\w\d_.'\-()\s]+$/gi.test(newFileNameWithoutExtension);

      setNewFileNameValid(!hasConflictingFileName && !hasForbiddenCharacters);
    },
    [props.workspaceFile, workspaces]
  );

  const renameWorkspaceFile = useCallback(
    async (newFileName: string | undefined) => {
      const trimmedNewFileName = newFileName?.trim();
      if (!trimmedNewFileName || !newFileNameValid) {
        resetWorkspaceFileName();
        return;
      }

      if (trimmedNewFileName === props.workspaceFile.nameWithoutExtension) {
        resetWorkspaceFileName();
        return;
      }

      await workspaces.renameFile({
        file: props.workspaceFile,
        newFileNameWithoutExtension: trimmedNewFileName.trim(),
      });
    },
    [props.workspaceFile, workspaces, resetWorkspaceFileName, newFileNameValid]
  );

  const handleWorkspaceFileNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (newFileNameValid && e.keyCode === 13 /* Enter */) {
        e.currentTarget.blur();
        setPopoverVisible(false);
      } else if (e.keyCode === 27 /* ESC */) {
        resetWorkspaceFileName();
        e.currentTarget.blur();
        setPopoverVisible(false);
      }
    },
    [newFileNameValid, resetWorkspaceFileName]
  );

  useEffect(resetWorkspaceFileName, [resetWorkspaceFileName]);
  const [isFilesDropdownOpen, setFilesDropdownOpen] = useState(false);
  const [isPopoverVisible, setPopoverVisible] = useState(false);

  return (
    <>
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        flexWrap={{ default: "nowrap" }}
        className={"kie-sandbox--file-switcher"}
      >
        <FlexItem style={{ display: "flex", alignItems: "baseline", minWidth: 0 }}>
          <Dropdown
            style={{ position: "relative" }}
            position={"left"}
            className={"kie-tools--masthead-hoverable"}
            isOpen={isFilesDropdownOpen}
            isPlain={true}
            toggle={
              <Toggle
                onToggle={(isOpen) =>
                  setFilesDropdownOpen((prev) => {
                    if (workspaceFileNameRef.current === document.activeElement) {
                      return prev;
                    } else {
                      return isOpen;
                    }
                  })
                }
                id={"editor-page-masthead-files-dropdown-toggle"}
              >
                <Flex flexWrap={{ default: "nowrap" }} alignItems={{ default: "alignItemsCenter" }}>
                  <FlexItem />
                  <FlexItem>
                    <b>
                      <FileLabel extension={props.workspaceFile.extension} />
                    </b>
                  </FlexItem>

                  <FlexItem style={{ minWidth: 0 }}>
                    <Popover
                      hasAutoWidth={true}
                      distance={15}
                      showClose={false}
                      shouldClose={() => setPopoverVisible(false)}
                      hideOnOutsideClick={true}
                      enableFlip={false}
                      withFocusTrap={false}
                      bodyContent={
                        <>
                          <FolderIcon />
                          &nbsp;&nbsp;{props.workspaceFile.relativeDirPath.split("/").join(" > ")}
                        </>
                      }
                      isVisible={isPopoverVisible}
                      position={"bottom-start"}
                    >
                      <div
                        data-testid={"toolbar-title"}
                        className={`kogito--editor__toolbar-name-container ${newFileNameValid ? "" : "invalid"}`}
                        style={{ width: "100%" }}
                      >
                        <Title
                          aria-label={"EmbeddedEditorFile name"}
                          headingLevel={"h3"}
                          size={"2xl"}
                          style={{ fontWeight: "bold" }}
                        >
                          {props.workspaceFile.nameWithoutExtension}
                        </Title>
                        <Tooltip
                          content={
                            <Text component={TextVariants.p}>
                              {`A file already exists at this location or this name has invalid characters. Please choose a different name.`}
                            </Text>
                          }
                          position={"bottom"}
                          trigger={"manual"}
                          isVisible={!newFileNameValid}
                          className="kogito--editor__light-tooltip"
                        >
                          <TextInput
                            style={{ fontWeight: "bold" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              //FIXME: Change this when it is possible to move a file.
                              if (props.workspaceFile.relativePath !== props.workspaceFile.name) {
                                setPopoverVisible(true);
                              }
                            }}
                            onKeyDown={handleWorkspaceFileNameKeyDown}
                            onChange={checkNewFileName}
                            ref={workspaceFileNameRef}
                            type={"text"}
                            aria-label={"Edit file name"}
                            className={"kogito--editor__toolbar-title"}
                            onBlur={(e) => renameWorkspaceFile(e.target.value)}
                          />
                        </Tooltip>
                      </div>
                    </Popover>
                  </FlexItem>
                  <FlexItem>
                    <CaretDownIcon color={"rgb(21, 21, 21)"} />
                  </FlexItem>
                </Flex>
              </Toggle>
            }
          >
            <FilesMenu
              workspace={props.workspace}
              workspaceFile={props.workspaceFile}
              isMenuOpen={isFilesDropdownOpen}
              setMenuOpen={setFilesDropdownOpen}
              onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
              workspaceGitStatusPromise={props.workspaceGitStatusPromise}
            />
          </Dropdown>
        </FlexItem>
      </Flex>
    </>
  );
}
let ctr: number = 0;
export function FilesMenu(props: {
  workspace: ActiveWorkspace;
  workspaceGitStatusPromise?: PromiseState<WorkspaceGitStatusType>;
  workspaceFile?: WorkspaceFile;
  onDeletedWorkspaceFile?: () => void;
  isMenuOpen: boolean;
  setMenuOpen?: (isOpen: boolean) => void;
  isNoHeightMaxLimit?: boolean;
}) {
  const [menuDrilledIn, setMenuDrilledIn] = useState<string[]>([ROOT_MENU_ID]);
  const [drilldownPath, setDrilldownPath] = useState<string[]>([props.workspace.descriptor.workspaceId]);
  const [menuHeights, setMenuHeights] = useState<{ [key: string]: number }>({});

  const [activeMenu, setActiveMenu] = useState(`dd${props.workspace.descriptor.workspaceId}`);

  const [filesMenuMode, setFilesMenuMode] = useState(FilesMenuMode.LIST);
  useEffect(() => {
    setMenuHeights({});
  }, [props.workspace, filesMenuMode]);

  const drillIn = useCallback((_event, fromMenuId, toMenuId, pathId) => {
    setMenuDrilledIn((prev) => [...prev, fromMenuId]);
    setDrilldownPath((prev) => [...prev, pathId]);
    setActiveMenu(toMenuId);
  }, []);

  const drillOut = useCallback((_event, toMenuId) => {
    setMenuDrilledIn((prev) => prev.slice(0, prev.length - 1));
    setDrilldownPath((prev) => prev.slice(0, prev.length - 1));
    setActiveMenu(toMenuId);
  }, []);

  const setHeight = useCallback((menuId: string, height: number) => {
    setMenuHeights((prev) => {
      console.warn(`${++ctr}`);
      if (prev[menuId] === undefined || (menuId !== ROOT_MENU_ID && prev[menuId] !== height)) {
        return { ...prev, [menuId]: height };
      }
      return prev;
    });
  }, []);
  const workspacesMenuItems = useMemo(() => {
    if (activeMenu === `dd${props.workspace.descriptor.workspaceId}`) {
      return <></>;
    }

    return (
      <WorkspacesMenuItems
        activeMenu={activeMenu}
        currentWorkspace={props.workspace}
        onSelectFile={() => props.setMenuOpen?.(false)}
        filesMenuMode={filesMenuMode}
        setFilesMenuMode={setFilesMenuMode}
        currentWorkspaceGitStatusPromise={props.workspaceGitStatusPromise}
        onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
        isNoHeightMaxLimit={props.isNoHeightMaxLimit}
      />
    );
  }, [activeMenu, filesMenuMode, props]);

  return (
    <Menu
      style={{
        boxShadow: "none",
        minWidth: `${MIN_FILE_SWITCHER_PANEL_WIDTH_IN_PX}px`,
      }}
      id={ROOT_MENU_ID}
      containsDrilldown={true}
      drilldownItemPath={drilldownPath}
      drilledInMenus={menuDrilledIn}
      activeMenu={activeMenu}
      onDrillIn={drillIn}
      onDrillOut={drillOut}
      onGetMenuHeight={setHeight}
      className={"kie-sandbox--files-menu"}
      isScrollable
    >
      <MenuContent
        // MAGIC NUMBER ALERT
        //
        // 204px is the exact number that allows the menu to grow to
        // the maximum size of the screen without adding scroll to the page.
        maxMenuHeight={!props.isNoHeightMaxLimit ? `calc(100vh - 204px)` : undefined}
        menuHeight={activeMenu === ROOT_MENU_ID ? undefined : `${menuHeights[activeMenu]}px`}
        style={{ overflow: "hidden" }}
      >
        <MenuList style={{ padding: 0 }}>
          <MenuItem
            itemId={props.workspace.descriptor.workspaceId}
            direction={"down"}
            drilldownMenu={
              <DrilldownMenu id={`dd${props.workspace.descriptor.workspaceId}`}>
                <FilesMenuItems
                  shouldFocusOnSearch={activeMenu === `dd${props.workspace.descriptor.workspaceId}`}
                  filesMenuMode={filesMenuMode}
                  setFilesMenuMode={setFilesMenuMode}
                  workspace={props.workspace}
                  currentWorkspaceFile={props.workspaceFile}
                  onSelectFile={() => props.setMenuOpen?.(false)}
                  currentWorkspaceGitStatusPromise={props.workspaceGitStatusPromise}
                  onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                  hideNavigationToAllWorkspaces={!props.workspaceFile}
                  isNoHeightMaxLimit={props.isNoHeightMaxLimit}
                />
              </DrilldownMenu>
            }
          >
            Current
          </MenuItem>
          {workspacesMenuItems}
        </MenuList>
      </MenuContent>
    </Menu>
  );
}

export function WorkspacesMenuItems(props: {
  activeMenu: string;
  currentWorkspace: ActiveWorkspace;
  onSelectFile: () => void;
  filesMenuMode: FilesMenuMode;
  setFilesMenuMode: React.Dispatch<React.SetStateAction<FilesMenuMode>>;
  currentWorkspaceGitStatusPromise?: PromiseState<WorkspaceGitStatusType>;
  onDeletedWorkspaceFile?: () => void;
  isNoHeightMaxLimit?: boolean;
}) {
  const editorEnvelopeLocator = useEditorEnvelopeLocator();
  const workspaceDescriptorsPromise = useWorkspaceDescriptorsPromise();
  const workspaceFilesPromise = useWorkspacesFilesPromise(workspaceDescriptorsPromise.data);
  const combined = useCombinedPromiseState({
    workspaceDescriptors: workspaceDescriptorsPromise,
    workspaceFiles: workspaceFilesPromise,
  });

  return (
    <>
      <Divider component={"li"} />
      <PromiseStateWrapper
        promise={combined}
        pending={
          <>
            <WorkspaceLoadingMenuItem />
            <WorkspaceLoadingMenuItem />
            <WorkspaceLoadingMenuItem />
            <WorkspaceLoadingMenuItem />
          </>
        }
        resolved={({ workspaceDescriptors, workspaceFiles }) => (
          <>
            {workspaceDescriptors
              .sort((a, b) => (new Date(a.lastUpdatedDateISO) < new Date(b.lastUpdatedDateISO) ? 1 : -1))
              .filter((descriptor) => descriptor.workspaceId !== props.currentWorkspace.descriptor.workspaceId)
              .map((descriptor) => (
                <React.Fragment key={descriptor.workspaceId}>
                  {workspaceFiles.get(descriptor.workspaceId)!.length === 1 && (
                    <MenuItem onClick={props.onSelectFile} className={"kie-tools--file-switcher-no-padding-menu-item"}>
                      <SingleFileWorkspaceDataList
                        workspaceDescriptor={descriptor}
                        file={workspaceFiles.get(descriptor.workspaceId)![0]}
                      />
                    </MenuItem>
                  )}
                  {workspaceFiles.get(descriptor.workspaceId)!.length > 1 && (
                    <MenuItem
                      style={{
                        borderTop: "var(--pf-global--BorderWidth--sm) solid var(--pf-global--BorderColor--100)",
                      }}
                      className={"kie-tools--file-switcher-no-padding-menu-item"}
                      itemId={descriptor.workspaceId}
                      direction={"down"}
                      drilldownMenu={
                        <DrilldownMenu id={`dd${descriptor.workspaceId}`}>
                          <FilesMenuItems
                            shouldFocusOnSearch={props.activeMenu === `dd${descriptor.workspaceId}`}
                            filesMenuMode={props.filesMenuMode}
                            setFilesMenuMode={props.setFilesMenuMode}
                            workspace={{ descriptor, files: workspaceFiles.get(descriptor.workspaceId) ?? [] }}
                            onSelectFile={props.onSelectFile}
                            onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                            isNoHeightMaxLimit={props.isNoHeightMaxLimit}
                            // not passing currentWorkspaceGitStatusPromise property as this is not a current workspace.
                          />
                        </DrilldownMenu>
                      }
                    >
                      <DataList aria-label="workspace-data-list" style={{ border: 0 }}>
                        {/* Need to replicate DatList's border here because of the angle bracket of drilldown menus */}
                        <DataListItem style={{ border: 0, backgroundColor: "transparent" }}>
                          <DataListItemRow>
                            <DataListItemCells
                              dataListCells={[
                                <DataListCell key="link" isFilled={false}>
                                  <WorkspaceListItem
                                    isBig={false}
                                    workspaceDescriptor={descriptor}
                                    allFiles={workspaceFiles.get(descriptor.workspaceId)!}
                                    editableFiles={workspaceFiles
                                      .get(descriptor.workspaceId)!
                                      .filter((f) => editorEnvelopeLocator.hasMappingFor(f.relativePath))}
                                  />
                                </DataListCell>,
                              ]}
                            />
                          </DataListItemRow>
                        </DataListItem>
                      </DataList>
                    </MenuItem>
                  )}
                </React.Fragment>
              ))}
          </>
        )}
      />
    </>
  );
}

export function FileSvg(props: { workspaceFile: WorkspaceFile }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const { previewSvgString } = usePreviewSvg(props.workspaceFile.workspaceId, props.workspaceFile.relativePath);

  useEffect(() => {
    if (previewSvgString.data) {
      const blob = new Blob([previewSvgString.data], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      imgRef.current!.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
      imgRef.current!.src = url;
    }
  }, [previewSvgString]);

  return (
    <>
      <PromiseStateWrapper
        pending={<Skeleton height={"180px"} style={{ margin: "10px" }} />}
        rejected={() => (
          <div style={{ height: "180px", margin: "10px", borderRadius: "5px", backgroundColor: "#EEE" }}>
            <Bullseye>
              <ImageIcon size={"xl"} color={"gray"} />
            </Bullseye>
          </div>
        )}
        promise={previewSvgString}
        resolved={() => (
          <Bullseye>
            <img
              style={{ height: "180px", margin: "10px" }}
              ref={imgRef}
              alt={`SVG for ${props.workspaceFile.relativePath}`}
            />
          </Bullseye>
        )}
      />
    </>
  );
}

export function SearchableFilesMenuGroup(props: {
  shouldFocusOnSearch: boolean;
  filesMenuMode: FilesMenuMode;
  allFiles: WorkspaceFile[];
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  children: (args: { filteredFiles: WorkspaceFile[] }) => React.ReactNode;
  selectedGitSyncStatusFilter?: WorkspaceGitLocalChangesStatus;
  setSelectedGitSyncStatusFilter?: (selection?: WorkspaceGitLocalChangesStatus) => void;
  isNoHeightMaxLimit?: boolean;
}) {
  const filteredFiles = useMemo(
    () => props.allFiles.filter((file) => file.name.toLowerCase().includes(props.search.toLowerCase())),
    [props.allFiles, props.search]
  );

  const height = useMemo(() => {
    if (props.filesMenuMode === FilesMenuMode.LIST) {
      // No reason to know the exact size.
      const sizeOfFirst50Elements = props.allFiles
        .slice(0, 50)
        .map((f) => getFileDataListHeight(f))
        .reduce((a, b) => a + b, 0);

      // MAGIC NUMBER ALERT
      //
      // 440px is the exact number that allows the menu to grow to the end of the screen without adding scroll  to the
      // entire page, It includes the first menu item, the search bar and the "View other files" button at the bottom.
      if (props.isNoHeightMaxLimit) {
        return props.allFiles.length
          ? `${filteredFiles.reduce((sum, current) => sum + getFileDataListHeight(current), 5)}px`
          : "172px";
      }
      return `max(300px, min(calc(100vh - 440px), ${sizeOfFirst50Elements}px))`;
    } else if (props.filesMenuMode === FilesMenuMode.CAROUSEL) {
      // MAGIC NUMBER ALERT
      //
      // 440px is the exact number that allows the menu to grow to the end of the screen without adding scroll  to the
      // entire page, It includes the first menu item, the search bar and the "View other files" button at the bottom.
      //
      // 280px is the size of a File SVG card.
      if (props.isNoHeightMaxLimit) {
        return "auto";
      }
      return `min(calc(100vh - 440px), calc(${props.allFiles.length} * 280px))`;
    } else {
      return "";
    }
  }, [filteredFiles, props.allFiles, props.filesMenuMode, props.isNoHeightMaxLimit]);

  return (
    <MenuGroup>
      {/* Allows for arrows to work when editing the text. */}
      <div style={{ overflowY: "auto", height }}>
        {filteredFiles.length > 0 && props.children({ filteredFiles })}
        {filteredFiles.length <= 0 && (
          <Bullseye>
            <EmptyState>
              <EmptyStateIcon icon={CubesIcon} />
              <Title headingLevel="h4" size="lg">
                {`No files match '${props.search}'.`}
              </Title>
            </EmptyState>
          </Bullseye>
        )}
      </div>
    </MenuGroup>
  );
}

export function FilesMenuItems(props: {
  workspace: ActiveWorkspace;
  currentWorkspaceGitStatusPromise?: PromiseState<WorkspaceGitStatusType>;
  currentWorkspaceFile?: WorkspaceFile;
  onDeletedWorkspaceFile?: () => void;
  onSelectFile: () => void;
  filesMenuMode: FilesMenuMode;
  setFilesMenuMode: React.Dispatch<React.SetStateAction<FilesMenuMode>>;
  shouldFocusOnSearch: boolean;
  hideNavigationToAllWorkspaces?: boolean;
  isNoHeightMaxLimit?: boolean;
}) {
  const history = useHistory();
  const routes = useRoutes();
  const editorEnvelopeLocator = useEditorEnvelopeLocator();
  const [filteredGitSyncStatus, setFilteredGitSyncStatus] = useState<WorkspaceGitLocalChangesStatus>();

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const deletedWorkspaceFiles = useMemo(() => {
    if (!props.currentWorkspaceGitStatusPromise) {
      return [];
    }
    return listDeletedFiles({
      workspaceDescriptor: props.workspace.descriptor,
      workspaceGitStatus: props.currentWorkspaceGitStatusPromise.data,
    });
  }, [props.workspace.descriptor, props.currentWorkspaceGitStatusPromise]);

  const allFiles = useMemo(() => {
    return [...props.workspace.files, ...deletedWorkspaceFiles];
  }, [deletedWorkspaceFiles, props.workspace.files]);

  const sortedAndFilteredFiles = useMemo(
    () =>
      allFiles
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
        .filter(
          (file) =>
            !filteredGitSyncStatus ||
            resolveGitLocalChangesStatus({
              workspaceGitStatus: props.currentWorkspaceGitStatusPromise?.data,
              file,
            }) === filteredGitSyncStatus
        ),
    [allFiles, props.currentWorkspaceGitStatusPromise, filteredGitSyncStatus]
  );

  const models = useMemo(
    () => sortedAndFilteredFiles.filter((file) => editorEnvelopeLocator.hasMappingFor(file.relativePath)),
    [editorEnvelopeLocator, sortedAndFilteredFiles]
  );

  const otherFiles = useMemo(
    () => sortedAndFilteredFiles.filter((file) => !editorEnvelopeLocator.hasMappingFor(file.relativePath)),
    [editorEnvelopeLocator, sortedAndFilteredFiles]
  );

  const [search, setSearch] = useState("");
  const [otherFilesSearch, setOtherFilesSearch] = useState("");

  const isCurrentWorkspaceFile = useCallback(
    (file: WorkspaceFile) => {
      return (
        props.workspace.descriptor.workspaceId === file.workspaceId &&
        props.currentWorkspaceFile?.relativePath === file.relativePath
      );
    },
    [props.currentWorkspaceFile?.relativePath, props.workspace.descriptor.workspaceId]
  );

  const CarouselCard = (props: {
    file: WorkspaceFile;
    workspaceDescriptor: WorkspaceDescriptor;
    workspaceGitStatus?: PromiseState<WorkspaceGitStatusType>;
    isCurrentWorkspaceFile?: boolean;
    onDeletedWorkspaceFile?: () => void;
    displayMode: FileListItemDisplayMode;
    onSelectFile: () => void;
  }) => {
    const cardInternals = [
      <CardHeader style={{ display: "block" }} key={0}>
        <CardHeaderMain>
          <FileListItem
            file={props.file}
            displayMode={props.displayMode}
            workspaceDescriptor={props.workspaceDescriptor}
            workspaceGitStatusPromise={props.workspaceGitStatus}
            isCurrentWorkspaceFile={props.isCurrentWorkspaceFile}
            onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
          />
        </CardHeaderMain>
      </CardHeader>,
      <Divider inset={{ default: "insetMd" }} key={1} />,
      <CardBody style={{ padding: 0 }} key={2}>
        <FileSvg workspaceFile={props.file} />
      </CardBody>,
    ];
    return (
      <Card
        key={props.file.relativePath}
        isSelectable={props.displayMode === FileListItemDisplayMode.enabled}
        isRounded={true}
        isCompact={true}
        isFullHeight={true}
        onSelect={props.onSelectFile}
        className={switchExpression(props.displayMode, {
          enabled: "kie-tools--file-list-item-enabled",
          deleted: "kie-tools--file-list-item-deleted",
          readonly: "kie-tools--file-list-item-readonly",
        })}
      >
        <div id={`scrollRef-${props.file}`} ref={props.isCurrentWorkspaceFile ? scrollRef : undefined}>
          {props.displayMode === FileListItemDisplayMode.enabled ? (
            <FileLink file={props.file}>{cardInternals}</FileLink>
          ) : (
            cardInternals
          )}
        </div>
      </Card>
    );
  };

  const getFileListItemMode = (file: WorkspaceFile) =>
    deletedWorkspaceFiles.some((it) => it.relativePath === file.relativePath)
      ? FileListItemDisplayMode.deleted
      : FileListItemDisplayMode.enabled;

  const countScrollOffset = useCallback(
    (files: WorkspaceFile[]) => {
      const item = files.find((it) => it.relativePath === props.currentWorkspaceFile?.relativePath);
      return (
        props.currentWorkspaceFile &&
        item &&
        files.slice(0, files.indexOf(item)).reduce((sum, current) => sum + getFileDataListHeight(current), 0)
      );
    },
    [props.currentWorkspaceFile]
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const task = setTimeout(() => {
      if (props.shouldFocusOnSearch) {
        searchInputRef.current?.focus();
      }
      if (props.filesMenuMode === FilesMenuMode.CAROUSEL) {
        scrollRef.current?.scrollIntoView();
      }
    }, 500);
    return () => {
      clearTimeout(task);
    };
  }, [props.shouldFocusOnSearch, props.filesMenuMode]);

  return (
    <>
      <Flex direction={{ default: "column" }} spacer={{ default: "spacerNone" }}>
        {!props.hideNavigationToAllWorkspaces && (
          <MenuItem direction="up" itemId={props.workspace.descriptor.workspaceId}>
            All
          </MenuItem>
        )}
        <FlexItem align={{ default: "alignLeft" }}>
          <MenuInput onKeyDown={(e) => e.stopPropagation()}>
            <SearchInput
              ref={searchInputRef}
              value={search}
              type={"search"}
              onChange={(_ev, value) => {
                setSearch(value);
              }}
              placeholder={`In '${props.workspace.descriptor.name}'`}
              // expandableInput={{isExpanded, onToggleExpand, toggleAriaLabel: 'Search files'}}
              style={{ fontSize: "small", lineHeight: "" }}
              onClick={(ev) => {
                ev.stopPropagation();
              }}
            />
          </MenuInput>
        </FlexItem>
        <Flex direction={{ default: "row" }} alignItems={{ default: "alignItemsCenter" }}>
          <Flex align={{ default: "alignRight" }}>
            <Tooltip content={"Filter only modified files"} position={"bottom"}>
              <Checkbox
                label={<Truncate content={"Only changed"} />}
                id={"filter-git-status-changed-locally"}
                aria-label={"Select to display only modified files"}
                isChecked={filteredGitSyncStatus === WorkspaceGitLocalChangesStatus.pending}
                onChange={(checked) => {
                  setFilteredGitSyncStatus(checked ? WorkspaceGitLocalChangesStatus.pending : undefined);
                }}
              />
            </Tooltip>
          </Flex>
          <FlexItem>
            <FilesMenuModeIcons filesMenuMode={props.filesMenuMode} setFilesMenuMode={props.setFilesMenuMode} />
          </FlexItem>
        </Flex>
      </Flex>
      <Divider component={"li"} />

      {props.filesMenuMode === FilesMenuMode.LIST && (
        <>
          <SearchableFilesMenuGroup
            search={search}
            setSearch={setSearch}
            filesMenuMode={props.filesMenuMode}
            shouldFocusOnSearch={props.shouldFocusOnSearch}
            allFiles={models}
            selectedGitSyncStatusFilter={filteredGitSyncStatus}
            setSelectedGitSyncStatusFilter={
              // filtering on git status makes sense just when we have the promise,
              // which is the case only for current workspace
              props.currentWorkspaceGitStatusPromise !== undefined ? setFilteredGitSyncStatus : undefined
            }
            isNoHeightMaxLimit={props.isNoHeightMaxLimit}
          >
            {({ filteredFiles }) => (
              <AutoSizer>
                {({ height, width }) => (
                  <VariableSizeList
                    height={height}
                    itemCount={filteredFiles.length}
                    itemSize={(index) => getFileDataListHeight(filteredFiles[index])}
                    width={width}
                    initialScrollOffset={countScrollOffset(filteredFiles)}
                  >
                    {({ index, style }) => (
                      <MenuItem
                        key={filteredFiles[index].relativePath}
                        onClick={props.onSelectFile}
                        component={"div"}
                        className={"kie-tools--file-switcher-no-padding-menu-item"}
                        isFocused={isCurrentWorkspaceFile(filteredFiles[index])}
                        isActive={isCurrentWorkspaceFile(filteredFiles[index])}
                      >
                        <FileDataList
                          file={filteredFiles[index]}
                          displayMode={getFileListItemMode(filteredFiles[index])}
                          workspaceGitStatusPromise={props.currentWorkspaceGitStatusPromise}
                          workspaceDescriptor={props.workspace.descriptor}
                          style={style}
                          isCurrentWorkspaceFile={isCurrentWorkspaceFile(filteredFiles[index])}
                          onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                        />
                      </MenuItem>
                    )}
                  </VariableSizeList>
                )}
              </AutoSizer>
            )}
          </SearchableFilesMenuGroup>
        </>
      )}

      {props.filesMenuMode === FilesMenuMode.CAROUSEL && (
        <SearchableFilesMenuGroup
          search={search}
          setSearch={setSearch}
          filesMenuMode={props.filesMenuMode}
          shouldFocusOnSearch={props.shouldFocusOnSearch}
          allFiles={models}
          selectedGitSyncStatusFilter={filteredGitSyncStatus}
          setSelectedGitSyncStatusFilter={
            // filtering on git status makes sense just when we have the promise,
            // which is the case only for current workspace
            props.currentWorkspaceGitStatusPromise !== undefined ? setFilteredGitSyncStatus : undefined
          }
          isNoHeightMaxLimit={props.isNoHeightMaxLimit}
        >
          {({ filteredFiles }) => (
            <Gallery
              hasGutter={true}
              style={{
                padding: "8px",
                borderTop: "var(--pf-global--BorderWidth--sm) solid var(--pf-global--BorderColor--100)",
              }}
            >
              {filteredFiles.slice(0, MAX_NUMBER_OF_CAROUSEL_ITEMS_SHOWN).map((file, index) => (
                <CarouselCard
                  key={index}
                  file={file}
                  workspaceDescriptor={props.workspace.descriptor}
                  workspaceGitStatus={props.currentWorkspaceGitStatusPromise}
                  isCurrentWorkspaceFile={isCurrentWorkspaceFile(file)}
                  displayMode={getFileListItemMode(file)}
                  onSelectFile={props.onSelectFile}
                  onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                />
              ))}
              {filteredFiles.length > MAX_NUMBER_OF_CAROUSEL_ITEMS_SHOWN && (
                <Card style={{ border: 0 }}>
                  <CardBody>
                    <Bullseye>
                      <div>...and {filteredFiles.length - MAX_NUMBER_OF_CAROUSEL_ITEMS_SHOWN} more.</div>
                    </Bullseye>
                  </CardBody>
                </Card>
              )}
            </Gallery>
          )}
        </SearchableFilesMenuGroup>
      )}
      {otherFiles.length > 0 && (
        <>
          <Divider component={"li"} />
          <MenuItem
            itemId={`other-${props.workspace.descriptor.workspaceId}`}
            direction="down"
            drilldownMenu={
              <DrilldownMenu id={`dd-other-${props.workspace.descriptor.workspaceId}`}>
                <SearchableFilesMenuGroup
                  search={search}
                  setSearch={setSearch}
                  filesMenuMode={FilesMenuMode.LIST} // always LIST, even for mode CAROUSEL
                  shouldFocusOnSearch={false}
                  allFiles={otherFiles}
                  isNoHeightMaxLimit={props.isNoHeightMaxLimit}
                >
                  {({ filteredFiles }) => (
                    <AutoSizer>
                      {({ height, width }) => (
                        <VariableSizeList
                          height={height}
                          itemCount={filteredFiles.length}
                          itemSize={(index) => getFileDataListHeight(filteredFiles[index])}
                          width={width}
                        >
                          {({ index, style }) => (
                            <MenuItem
                              component={"div"}
                              onClick={() => {}}
                              style={style}
                              className={"kie-tools--file-switcher-no-padding-menu-item"}
                            >
                              <FileDataList
                                file={filteredFiles[index]}
                                displayMode={FileListItemDisplayMode.readonly}
                                workspaceGitStatusPromise={props.currentWorkspaceGitStatusPromise}
                                workspaceDescriptor={props.workspace.descriptor}
                                onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                              />
                            </MenuItem>
                          )}
                        </VariableSizeList>
                      )}
                    </AutoSizer>
                  )}
                </SearchableFilesMenuGroup>
                <MenuItem itemId={"back-up"} direction="up">
                  Back To Models
                </MenuItem>
              </DrilldownMenu>
            }
          >
            View other files
          </MenuItem>
        </>
      )}
    </>
  );
}

export function FilesMenuModeIcons(props: {
  filesMenuMode: FilesMenuMode;
  setFilesMenuMode: React.Dispatch<React.SetStateAction<FilesMenuMode>>;
}) {
  return (
    <>
      {props.filesMenuMode === FilesMenuMode.CAROUSEL && (
        <Button
          className={"kie-tools--masthead-hoverable"}
          variant="plain"
          aria-label="Switch to list view"
          onClick={(e) => {
            e.stopPropagation();
            props.setFilesMenuMode(FilesMenuMode.LIST);
          }}
        >
          <ListIcon />
        </Button>
      )}
      {props.filesMenuMode === FilesMenuMode.LIST && (
        <Button
          className={"kie-tools--masthead-hoverable"}
          variant="plain"
          aria-label="Switch to carousel view"
          onClick={(e) => {
            e.stopPropagation();
            props.setFilesMenuMode(FilesMenuMode.CAROUSEL);
          }}
        >
          <ThLargeIcon />
        </Button>
      )}
    </>
  );
}
