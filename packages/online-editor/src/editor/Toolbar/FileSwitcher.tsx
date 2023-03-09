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
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { join } from "path";
import { Dropdown } from "@patternfly/react-core/dist/js/components/Dropdown";
import { Flex, FlexItem } from "@patternfly/react-core/dist/js/layouts/Flex";
import { FileLabel } from "../../filesList/FileLabel";
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
import { Button } from "@patternfly/react-core/dist/js/components/Button";
import { WorkspaceDescriptor } from "@kie-tools-core/workspaces-git-fs/dist/worker/api/WorkspaceDescriptor";
import { useWorkspacesFilesPromise } from "@kie-tools-core/workspaces-git-fs/dist/hooks/WorkspacesFiles";
import { Skeleton } from "@patternfly/react-core/dist/js/components/Skeleton";
import { Card, CardBody, CardHeader, CardHeaderMain } from "@patternfly/react-core/dist/js/components/Card";
import { Gallery } from "@patternfly/react-core/dist/js/layouts/Gallery";
import { Bullseye } from "@patternfly/react-core/dist/js/layouts/Bullseye";
import { EmptyState, EmptyStateIcon } from "@patternfly/react-core/dist/js/components/EmptyState";
import { CubesIcon } from "@patternfly/react-icons/dist/js/icons/cubes-icon";
import { useEditorEnvelopeLocator } from "../../envelopeLocator/hooks/EditorEnvelopeLocatorContext";
import { VariableSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import {
  FileDataList,
  FileLink,
  FileListItem,
  FileListItemDisplayMode,
  getFileDataListHeight,
  SingleFileWorkspaceDataList,
} from "../../filesList/FileDataList";
import {
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
} from "@patternfly/react-core/dist/js/components/DataList";
import { WorkspaceListItem } from "../../workspace/components/WorkspaceListItem";
import { usePreviewSvg } from "../../previewSvgs/PreviewSvgHooks";
import { WorkspaceLoadingMenuItem } from "../../workspace/components/WorkspaceLoadingCard";
import { Grid, GridItem } from "@patternfly/react-core/dist/js/layouts/Grid";
import {
  listDeletedFiles,
  resolveGitLocalChangesStatus,
  WorkspaceGitLocalChangesStatus,
} from "../../workspace/components/WorkspaceStatusIndicator";
import { Checkbox } from "@patternfly/react-core/dist/js/components/Checkbox";
import { SearchInput } from "@patternfly/react-core/dist/js/components/SearchInput";
import { switchExpression } from "../../switchExpression/switchExpression";
import { WorkspaceGitStatusType } from "@kie-tools-core/workspaces-git-fs/dist/hooks/WorkspaceHooks";

const ROOT_MENU_ID = "rootMenu";

enum FilesMenuMode {
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

export const getWorkspacesDataListSize = (workspaceFilesCount?: number) => {
  return workspaceFilesCount ? (workspaceFilesCount > 1 ? 152 : 102) : 0;
};

export function FilesMenu(props: {
  workspace: ActiveWorkspace;
  workspaceGitStatusPromise?: PromiseState<WorkspaceGitStatusType>;
  workspaceFile?: WorkspaceFile;
  onDeletedWorkspaceFile?: () => void;
  isMenuOpen: boolean;
  setMenuOpen?: (isOpen: boolean) => void;
  replaceNavigationToAllWorkspaces?: JSX.Element;
}) {
  const editorEnvelopeLocator = useEditorEnvelopeLocator();
  const [menuDrilledIn, setMenuDrilledIn] = useState<string[]>([ROOT_MENU_ID]);
  const [drilldownPath, setDrilldownPath] = useState<string[]>([props.workspace.descriptor.workspaceId]);
  const [menuHeights, setMenuHeights] = useState<{ [key: string]: number }>({});

  const [activeMenu, setActiveMenu] = useState(`dd${props.workspace.descriptor.workspaceId}`);
  const [isLoadAllWorkspaces, setLoadAllWorskpaces] = useState(false);

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
    if (toMenuId === ROOT_MENU_ID) {
      setLoadAllWorskpaces(true);
    }
  }, []);

  const setHeight = useCallback((menuId: string, height: number) => {
    setMenuHeights((prev) => {
      if (prev[menuId] === undefined || (menuId !== ROOT_MENU_ID && prev[menuId] !== height)) {
        return { ...prev, [menuId]: height };
      }
      return prev;
    });
  }, []);

  const workspacesMenuItems = useMemo(() => {
    if (!isLoadAllWorkspaces) {
      return <></>;
    }
    return (
      <WorkspacesMenuItems currentWorkspace={props.workspace}>
        {({ filteredWorkspaces }) => {
          return (
            <AutoSizer>
              {({ height, width }) => {
                return (
                  <VariableSizeList
                    height={height}
                    itemCount={filteredWorkspaces.length}
                    itemSize={(index) => getWorkspacesDataListSize(filteredWorkspaces[index].files.length)}
                    width={width}
                  >
                    {({ index, style }) => (
                      <>
                        {filteredWorkspaces[index].files.length === 1 && (
                          <MenuItem className={"kie-tools--file-switcher-no-padding-menu-item"} style={style}>
                            <SingleFileWorkspaceDataList
                              workspaceDescriptor={filteredWorkspaces[index].descriptor}
                              file={filteredWorkspaces[index].files![0]}
                            />
                          </MenuItem>
                        )}
                        {filteredWorkspaces[index].files.length > 1 && (
                          <MenuItem
                            style={{
                              ...style,
                              borderTop: "var(--pf-global--BorderWidth--sm) solid var(--pf-global--BorderColor--100)",
                            }}
                            className={"kie-tools--file-switcher-no-padding-menu-item"}
                            itemId={filteredWorkspaces[index].descriptor.workspaceId}
                            direction={"down"}
                            drilldownMenu={() => (
                              <DrilldownMenu
                                id={`dd${filteredWorkspaces[index].descriptor.workspaceId}`}
                                style={{ position: "fixed" }}
                              >
                                <FilesMenuItems
                                  filesMenuMode={filesMenuMode}
                                  setFilesMenuMode={setFilesMenuMode}
                                  workspace={filteredWorkspaces[index]}
                                  onSelectFile={() => props.setMenuOpen?.(false)}
                                  onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                                  // not passing currentWorkspaceGitStatusPromise property as this is not a current workspace.
                                />
                                {/* <MenuItem itemId={"fake"} direction={"up"}component={"div"}>FAke</MenuItem> */}
                              </DrilldownMenu>
                            )}
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
                                          workspaceDescriptor={filteredWorkspaces[index].descriptor}
                                          allFiles={filteredWorkspaces[index].files}
                                          editableFiles={filteredWorkspaces[index].files.filter((f) =>
                                            editorEnvelopeLocator.hasMappingFor(f.relativePath)
                                          )}
                                        />
                                      </DataListCell>,
                                    ]}
                                  />
                                </DataListItemRow>
                              </DataListItem>
                            </DataList>
                          </MenuItem>
                        )}
                      </>
                    )}
                  </VariableSizeList>
                );
              }}
            </AutoSizer>
          );
        }}
      </WorkspacesMenuItems>
    );
  }, [editorEnvelopeLocator, filesMenuMode, isLoadAllWorkspaces, props]);

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
    >
      <MenuContent
        // MAGIC NUMBER ALERT
        //
        // 204px is the exact number that allows the menu to grow to
        // the maximum size of the screen without adding scroll to the page.
        maxMenuHeight={"calc(100vh - 204px)"}
        menuHeight={activeMenu === ROOT_MENU_ID ? undefined : `${menuHeights[activeMenu]}px`}
        // style={{ overflow: "hidden" }}
      >
        <MenuList style={{ padding: 0 }}>
          <MenuItem
            itemId={props.workspace.descriptor.workspaceId}
            direction={"down"}
            drilldownMenu={
              <DrilldownMenu id={`dd${props.workspace.descriptor.workspaceId}`}>
                <FilesMenuItems
                  filesMenuMode={filesMenuMode}
                  setFilesMenuMode={setFilesMenuMode}
                  workspace={props.workspace}
                  currentWorkspaceFile={props.workspaceFile}
                  onSelectFile={() => props.setMenuOpen?.(false)}
                  currentWorkspaceGitStatusPromise={props.workspaceGitStatusPromise}
                  onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                  replaceNavigationToAllWorkspaces={props.replaceNavigationToAllWorkspaces}
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
  currentWorkspace: ActiveWorkspace;
  children: (args: {
    filteredWorkspaces: { descriptor: WorkspaceDescriptor; files: WorkspaceFile[] }[];
  }) => React.ReactNode;
}) {
  const workspaceDescriptorsPromise = useWorkspaceDescriptorsPromise();
  const workspaceFilesPromise = useWorkspacesFilesPromise(workspaceDescriptorsPromise.data);
  const combined = useCombinedPromiseState({
    workspaceDescriptors: workspaceDescriptorsPromise,
    workspaceFiles: workspaceFilesPromise,
  });

  return (
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
      resolved={({ workspaceDescriptors, workspaceFiles }) => {
        const filteredWorkspaces = workspaceDescriptors
          .sort((a, b) => (new Date(a.lastUpdatedDateISO) < new Date(b.lastUpdatedDateISO) ? 1 : -1))
          .filter((descriptor) => descriptor.workspaceId !== props.currentWorkspace.descriptor.workspaceId)
          .map((it) => ({ descriptor: it, files: workspaceFiles.get(it.workspaceId) ?? [] }));

        return (
          <MenuGroup>
            {/* Allows for arrows to work when editing the text. */}
            <div
              style={{
                overflowY: "auto",
                height: `min(calc(100vh - 244px),${filteredWorkspaces.reduce(
                  (sum, current) => sum + getWorkspacesDataListSize(current.files.length),
                  0
                )}px)`,
              }}
            >
              {workspaceDescriptors.length > 0 && props.children({ filteredWorkspaces })}
              {workspaceDescriptors.length <= 0 && (
                <Bullseye>
                  <EmptyState>
                    <EmptyStateIcon icon={CubesIcon} />
                    <Title headingLevel="h4" size="lg">
                      {"Nothing here."}
                    </Title>
                  </EmptyState>
                </Bullseye>
              )}
            </div>
          </MenuGroup>
        );
      }}
    />
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
  filesMenuMode: FilesMenuMode;
  allFiles: WorkspaceFile[];
  filteredFiles: WorkspaceFile[];
  search: string;
  children: (args: { filteredFiles: WorkspaceFile[] }) => React.ReactNode;
  style?: React.CSSProperties;
}) {
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
      return `max(300px, min(calc(100vh - 440px), ${sizeOfFirst50Elements}px))`;
    } else if (props.filesMenuMode === FilesMenuMode.CAROUSEL) {
      // MAGIC NUMBER ALERT
      //
      // 440px is the exact number that allows the menu to grow to the end of the screen without adding scroll  to the
      // entire page, It includes the first menu item, the search bar and the "View other files" button at the bottom.
      //
      // 280px is the size of a File SVG card.
      return `min(calc(100vh - 440px), calc(${props.allFiles.length} * 280px))`;
    } else {
      return "";
    }
  }, [props.allFiles, props.filesMenuMode]);

  return (
    <MenuGroup>
      {/* Allows for arrows to work when editing the text. */}
      <div style={{ ...props.style, height }}>
        {props.filteredFiles.length > 0 && props.children({ filteredFiles: props.filteredFiles })}
        {props.filteredFiles.length <= 0 && (
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
  replaceNavigationToAllWorkspaces?: JSX.Element;
}) {
  const editorEnvelopeLocator = useEditorEnvelopeLocator();
  const [filteredGitSyncStatus, setFilteredGitSyncStatus] = useState<WorkspaceGitLocalChangesStatus>();

  const [search, setSearch] = useState("");
  const [isScroll, setScroll] = useState(true);

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

  const sortedFiles = useMemo(() => allFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath)), [allFiles]);

  const models = useMemo(
    () => sortedFiles.filter((file) => editorEnvelopeLocator.hasMappingFor(file.relativePath)),
    [editorEnvelopeLocator, sortedFiles]
  );

  const otherFiles = useMemo(
    () => sortedFiles.filter((file) => !editorEnvelopeLocator.hasMappingFor(file.relativePath)),
    [editorEnvelopeLocator, sortedFiles]
  );

  const filteredModels = useMemo(
    () =>
      models
        .filter((file) => file.name.toLowerCase().includes(search.toLowerCase()))
        .filter(
          (file) =>
            !filteredGitSyncStatus ||
            resolveGitLocalChangesStatus({
              workspaceGitStatus: props.currentWorkspaceGitStatusPromise?.data,
              file,
            }) === filteredGitSyncStatus
        ),
    [filteredGitSyncStatus, models, props.currentWorkspaceGitStatusPromise?.data, search]
  );
  const filteredOtherFiles = useMemo(
    () => otherFiles.filter((file) => file.name.toLowerCase().includes(search.toLowerCase())),
    [otherFiles, search]
  );

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
        <div
          id={`scrollRef-${props.file.relativePath}`}
          ref={props.isCurrentWorkspaceFile ? carouselScrollRef : undefined}
        >
          {props.displayMode === FileListItemDisplayMode.enabled ? (
            <FileLink file={props.file}>{cardInternals}</FileLink>
          ) : (
            cardInternals
          )}
        </div>
      </Card>
    );
  };

  const getFileListItemMode = useCallback(
    (file: WorkspaceFile) =>
      deletedWorkspaceFiles.some((it) => it.relativePath === file.relativePath)
        ? FileListItemDisplayMode.deleted
        : FileListItemDisplayMode.enabled,
    [deletedWorkspaceFiles]
  );

  const computedInitialScrollOffset = useMemo(() => {
    if (props.filesMenuMode !== FilesMenuMode.LIST || !isScroll || !props.currentWorkspaceFile) {
      return;
    }
    const index = filteredModels.findIndex((it) => it.relativePath === props.currentWorkspaceFile?.relativePath);
    if (index < 0) {
      return 0;
    }
    return filteredModels.slice(0, index).reduce((sum, current) => sum + getFileDataListHeight(current), 0);
  }, [filteredModels, isScroll, props.currentWorkspaceFile, props.filesMenuMode]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const carouselScrollRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<VariableSizeList>(null);
  useEffect(() => {
    const task = setTimeout(() => {
      if (props.filesMenuMode === FilesMenuMode.CAROUSEL && isScroll) {
        carouselScrollRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      if (props.filesMenuMode === FilesMenuMode.LIST && isScroll) {
        listScrollRef.current?.scrollToItem(
          filteredModels.findIndex((it) => it.relativePath === props.currentWorkspaceFile?.relativePath)
        );
      }
      searchInputRef.current?.focus({ preventScroll: true });
    }, 500);
    return () => {
      clearTimeout(task);
    };
  }, [props.filesMenuMode, isScroll, filteredGitSyncStatus, props.currentWorkspaceFile?.relativePath, filteredModels]);

  const searchInput = useMemo(() => {
    return (
      <MenuInput onKeyDown={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <SearchInput
          ref={searchInputRef}
          value={search}
          type={"search"}
          onChange={(_ev, value) => {
            setSearch(value);
          }}
          placeholder={`In '${props.workspace.descriptor.name}'`}
          style={{ fontSize: "small" }}
          onClick={(ev) => {
            ev.stopPropagation();
          }}
        />
      </MenuInput>
    );
  }, [props.workspace.descriptor.name, search]);

  return (
    <>
      <Grid hasGutter style={{ alignItems: "center", paddingLeft: "5px", paddingRight: "5px" }}>
        <GridItem span={5}>
          {!props.replaceNavigationToAllWorkspaces ? (
            <MenuItem direction={"up"} itemId={`${props.workspace.descriptor.workspaceId}-breadcrumb`}>
              All
            </MenuItem>
          ) : (
            props.replaceNavigationToAllWorkspaces
          )}
        </GridItem>
        <GridItem span={2}>
          <Flex justifyContent={{ default: "justifyContentCenter" }}>
            <FilesMenuModeIcons filesMenuMode={props.filesMenuMode} setFilesMenuMode={props.setFilesMenuMode} />
          </Flex>
        </GridItem>
        <GridItem span={5}>
          <MenuItem
            itemId={`other-${props.workspace.descriptor.workspaceId}`}
            direction={"down"}
            isDisabled={filteredOtherFiles.length < 1}
            onClick={(ev) => {
              setScroll(false);
            }}
            drilldownMenu={
              <DrilldownMenu id={`dd-other-${props.workspace.descriptor.workspaceId}`} style={{ position: "fixed" }}>
                <MenuItem
                  itemId={"back-up"}
                  direction={"up"}
                  onClick={(ev) => {
                    setScroll(true);
                  }}
                >
                  Back To Models
                </MenuItem>
                <SearchableFilesMenuGroup
                  search={search}
                  filesMenuMode={FilesMenuMode.LIST} // always LIST, even for mode CAROUSEL
                  allFiles={otherFiles}
                  filteredFiles={filteredOtherFiles}
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
                              className={"kie-tools--file-switcher-no-padding-menu-item"}
                              style={style}
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
              </DrilldownMenu>
            }
          >
            Other files
          </MenuItem>
        </GridItem>
        <GridItem span={8}>{searchInput}</GridItem>
        <GridItem span={4}>
          <MenuInput>
            <Tooltip content={"Filter only modified files"} position={"bottom"}>
              <Checkbox
                label={"Only changed"}
                id={"filter-git-status-changed-locally"}
                aria-label={"Select to display only modified files"}
                isChecked={filteredGitSyncStatus === WorkspaceGitLocalChangesStatus.pending}
                onChange={(checked) => {
                  setFilteredGitSyncStatus(checked ? WorkspaceGitLocalChangesStatus.pending : undefined);
                }}
              />
            </Tooltip>
          </MenuInput>
        </GridItem>
      </Grid>
      <Divider component={"li"} />

      {props.filesMenuMode === FilesMenuMode.LIST && (
        <SearchableFilesMenuGroup
          search={search}
          filesMenuMode={props.filesMenuMode}
          allFiles={models}
          filteredFiles={filteredModels}
        >
          {({ filteredFiles }) => {
            return (
              <AutoSizer>
                {({ height, width }) => (
                  <VariableSizeList
                    height={height}
                    itemCount={filteredFiles.length}
                    itemSize={(index) => getFileDataListHeight(filteredFiles[index])}
                    width={width}
                    initialScrollOffset={computedInitialScrollOffset}
                    ref={listScrollRef}
                  >
                    {({ index, style }) => (
                      <MenuItem
                        key={filteredFiles[index].relativePath}
                        onClick={props.onSelectFile}
                        component={"div"}
                        className={"kie-tools--file-switcher-no-padding-menu-item"}
                        isFocused={isCurrentWorkspaceFile(filteredFiles[index])}
                        isActive={isCurrentWorkspaceFile(filteredFiles[index])}
                        style={style}
                      >
                        <FileDataList
                          file={filteredFiles[index]}
                          displayMode={getFileListItemMode(filteredFiles[index])}
                          workspaceGitStatusPromise={props.currentWorkspaceGitStatusPromise}
                          workspaceDescriptor={props.workspace.descriptor}
                          isCurrentWorkspaceFile={isCurrentWorkspaceFile(filteredFiles[index])}
                          onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                        />
                      </MenuItem>
                    )}
                  </VariableSizeList>
                )}
              </AutoSizer>
            );
          }}
        </SearchableFilesMenuGroup>
      )}

      {props.filesMenuMode === FilesMenuMode.CAROUSEL && (
        <SearchableFilesMenuGroup
          search={search}
          filesMenuMode={props.filesMenuMode}
          allFiles={models}
          filteredFiles={filteredModels}
          style={{ overflowY: "auto" }}
        >
          {({ filteredFiles }) => {
            const isCurrentFileOutsideOfShownList =
              filteredFiles.findIndex((file) => file.relativePath === props.currentWorkspaceFile?.relativePath) >=
              MAX_NUMBER_OF_CAROUSEL_ITEMS_SHOWN;
            const isCurrentFileAmongFilteredFiles =
              filteredFiles.findIndex((file) => file.relativePath === props.currentWorkspaceFile?.relativePath) >= 0;
            return (
              <Gallery
                hasGutter={true}
                style={{
                  padding: "8px",
                  borderTop: "var(--pf-global--BorderWidth--sm) solid var(--pf-global--BorderColor--100)",
                }}
              >
                {!isCurrentFileAmongFilteredFiles && <div ref={carouselScrollRef} />}
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
                  <>
                    {props.currentWorkspaceFile && isCurrentFileOutsideOfShownList && (
                      <CarouselCard
                        file={props.currentWorkspaceFile}
                        workspaceDescriptor={props.workspace.descriptor}
                        workspaceGitStatus={props.currentWorkspaceGitStatusPromise}
                        isCurrentWorkspaceFile={isCurrentWorkspaceFile(props.currentWorkspaceFile)}
                        displayMode={getFileListItemMode(props.currentWorkspaceFile)}
                        onSelectFile={props.onSelectFile}
                        onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
                      />
                    )}
                    <Card style={{ border: 0 }}>
                      <CardBody>
                        <Bullseye>
                          <div>
                            ...and{" "}
                            {filteredFiles.length -
                              MAX_NUMBER_OF_CAROUSEL_ITEMS_SHOWN -
                              (isCurrentFileOutsideOfShownList ? 1 : 0)}{" "}
                            more.
                          </div>
                        </Bullseye>
                      </CardBody>
                    </Card>
                  </>
                )}
              </Gallery>
            );
          }}
        </SearchableFilesMenuGroup>
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
