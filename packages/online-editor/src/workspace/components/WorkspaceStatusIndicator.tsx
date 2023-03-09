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
import * as React from "react";
import { WorkspaceGitStatusType } from "@kie-tools-core/workspaces-git-fs/dist/hooks/WorkspaceHooks";
import { useCallback } from "react";
import {
  isGitBasedWorkspaceKind,
  WorkspaceKind,
} from "@kie-tools-core/workspaces-git-fs/dist/worker/api/WorkspaceOrigin";
import { usePrevious } from "@kie-tools-core/react-hooks/dist/usePrevious";
import { Title } from "@patternfly/react-core/dist/js/components/Title";
import { Tooltip } from "@patternfly/react-core/dist/js/components/Tooltip";
import { OutlinedClockIcon } from "@patternfly/react-icons/dist/js/icons/outlined-clock-icon";
import { SecurityIcon } from "@patternfly/react-icons/dist/js/icons/security-icon";
import { CheckCircleIcon } from "@patternfly/react-icons/dist/js/icons/check-circle-icon";
import { useNavigationBlocker, useRoutes } from "../../navigation/Hooks";
import { matchPath } from "react-router";
import { WorkspaceDescriptor } from "@kie-tools-core/workspaces-git-fs/dist/worker/api/WorkspaceDescriptor";
import { WorkspaceFile } from "@kie-tools-core/workspaces-git-fs/dist/context/WorkspacesContext";
import { switchExpression } from "../../switchExpression/switchExpression";
import { Flex, FlexItem } from "@patternfly/react-core/dist/js/layouts/Flex";
import { GitStatusIndicatorActions, GitStatusIndicatorActionVariant } from "./GitStatusIndicatorActions";
import { FileStageStatus } from "@kie-tools-core/workspaces-git-fs/dist/services/GitService";
import { PromiseState } from "@kie-tools-core/react-hooks/dist/PromiseState";

/**
 * Indicates current git sync status either for whole Workspace or a particular WorkspaceFile, depending on the provided properties.
 */
export function GitStatusIndicator(props: {
  workspaceDescriptor: WorkspaceDescriptor;
  workspaceGitStatusPromise?: PromiseState<WorkspaceGitStatusType>;
  workspaceFile?: WorkspaceFile;
  children?: JSX.Element;
  isHoverable?: boolean;
}) {
  // We use this trick to prevent the icon from blinking while updating.
  const prev = usePrevious(props.workspaceGitStatusPromise?.data);

  const localChangesStatus = React.useMemo(() => {
    return resolveGitLocalChangesStatus({
      workspaceGitStatus: props.workspaceGitStatusPromise?.data ?? prev,
      file: props.workspaceFile,
    });
  }, [prev, props]);

  const indicatorTooltip = React.useMemo(() => {
    if (!props.workspaceGitStatusPromise?.data?.hasLocalChanges) {
      return [];
    }

    const tooltipForStageStatus = (stageStatus?: FileStageStatus) => {
      const modifiedTooltip = (
        <Tooltip content={"Modified."} position={"bottom"}>
          <small>
            <i>M</i>
          </small>
        </Tooltip>
      );
      const deletedTooltip = (
        <Tooltip content={"Deleted file."} position={"bottom"}>
          <small>
            <i>D</i>
          </small>
        </Tooltip>
      );
      const addedTooltip = (
        <Tooltip content={"New file."} position={"bottom"}>
          <small>
            <i>A</i>
          </small>
        </Tooltip>
      );
      return switchExpression(stageStatus, {
        added: addedTooltip,
        modified: modifiedTooltip,
        deleted: deletedTooltip,
        default: <></>,
      });
    };
    return props.workspaceFile
      ? tooltipForStageStatus(
          props.workspaceGitStatusPromise?.data.fileStageStatuses.find(
            ({ path }) => path === props.workspaceFile?.relativePath
          )?.status
        )
      : tooltipForStageStatus(FileStageStatus.modified);
  }, [props.workspaceGitStatusPromise, props.workspaceFile]);

  return (
    <Flex
      flexWrap={{ default: "nowrap" }}
      spaceItems={{ default: "spaceItemsMd" }}
      className={"kie-tools--git-status-indicator"}
    >
      {(isGitBasedWorkspaceKind(props.workspaceDescriptor.origin.kind) ||
        props.workspaceDescriptor.origin.kind === WorkspaceKind.LOCAL) &&
        !props.workspaceFile &&
        switchExpression(resolveGitSyncStatus(props.workspaceGitStatusPromise?.data ?? prev), {
          pending: (
            <Title headingLevel={"h6"} style={{ display: "inline", cursor: "default" }}>
              <Tooltip content={`There are new changes since your last sync.`} position={"bottom"}>
                <small>
                  <SecurityIcon color={"gray"} />
                </small>
              </Tooltip>
            </Title>
          ),
          synced: (
            <Title headingLevel={"h6"} style={{ display: "inline", cursor: "default" }}>
              <Tooltip content={`All files are synced.`} position={"bottom"}>
                <small>
                  <CheckCircleIcon color={"green"} />
                </small>
              </Tooltip>
            </Title>
          ),
          unknown: (
            <Title headingLevel={"h6"} style={{ display: "inline", cursor: "default" }}>
              <Tooltip content={"Checking status..."} position={"right"}>
                <small>
                  <OutlinedClockIcon color={"gray"} />
                </small>
              </Tooltip>
            </Title>
          ),
        })}
      {switchExpression(localChangesStatus, {
        pending: (
          <Flex
            flexWrap={{ default: "nowrap" }}
            spaceItems={{ default: "spaceItemsSm" }}
            alignItems={{ default: "alignItemsCenter" }}
            onClick={(ev) => {
              ev.stopPropagation();
            }}
          >
            <FlexItem>
              <Title headingLevel={"h6"} style={{ display: "inline", cursor: "default" }}>
                <Flex spaceItems={{ default: "spaceItemsXs" }} direction={{ default: "row" }}>
                  {indicatorTooltip}
                </Flex>
              </Title>
            </FlexItem>
            <FlexItem
              alignSelf={{ default: "alignSelfCenter" }}
              className={props.isHoverable ? "kie-tools--git-status-indicator-children-hoverable" : ""}
            >
              {props.children}
            </FlexItem>
          </Flex>
        ),
        default: <></>,
      })}
    </Flex>
  );
}

export function WorkspaceStatusIndicator(props: {
  workspaceDescriptor: WorkspaceDescriptor;
  workspaceGitStatusPromise: PromiseState<WorkspaceGitStatusType>;
  currentWorkspaceFile: WorkspaceFile;
  onDeletedWorkspaceFile: () => void;
}) {
  const routes = useRoutes();
  const [isActionsDropdownOpen, setActionsDropdownOpen] = React.useState(false);

  const isEverythingPersistedByTheUser =
    props.workspaceGitStatusPromise &&
    props.workspaceGitStatusPromise.data?.isSynced &&
    !props.workspaceGitStatusPromise.data?.hasLocalChanges;

  // Prevent from navigating away
  useNavigationBlocker(
    `block-navigation-for-${props.workspaceDescriptor.workspaceId}`,
    useCallback(
      ({ location }) => {
        const match = matchPath<{ workspaceId: string }>(location.pathname, {
          strict: true,
          exact: true,
          sensitive: false,
          path: routes.workspaceWithFilePath.path({
            workspaceId: ":workspaceId",
            fileRelativePath: ":fileRelativePath*",
            extension: ":extension",
          }),
        });

        if (match?.params.workspaceId === props.workspaceDescriptor.workspaceId) {
          return false;
        }

        return !isEverythingPersistedByTheUser;
      },
      [props.workspaceDescriptor.workspaceId, routes.workspaceWithFilePath, isEverythingPersistedByTheUser]
    )
  );
  return (
    <GitStatusIndicator
      workspaceDescriptor={props.workspaceDescriptor}
      workspaceGitStatusPromise={props.workspaceGitStatusPromise}
      isHoverable={!isActionsDropdownOpen}
    >
      <GitStatusIndicatorActions
        variant={GitStatusIndicatorActionVariant.dropdown}
        isOpen={isActionsDropdownOpen}
        setOpen={setActionsDropdownOpen}
        workspaceDescriptor={props.workspaceDescriptor}
        currentWorkspaceFile={props.currentWorkspaceFile}
        onDeletedWorkspaceFile={props.onDeletedWorkspaceFile}
        workspaceGitStatusPromise={props.workspaceGitStatusPromise}
        expandDirection={"right"}
      />
    </GitStatusIndicator>
  );
}

export enum WorkspaceGitSyncStatus {
  synced = "synced",
  unknown = "unknown",
  pending = "pending",
}

export enum WorkspaceGitLocalChangesStatus {
  synced = "synced",
  unknown = "unknown",
  pending = "pending",
}

export const resolveGitLocalChangesStatus = (args: {
  workspaceGitStatus?: WorkspaceGitStatusType;
  file?: WorkspaceFile;
}) => {
  if (args.workspaceGitStatus === undefined) {
    return WorkspaceGitLocalChangesStatus.unknown;
  }

  if (args.file) {
    return args.workspaceGitStatus.fileStageStatuses.some((stageStatus) => stageStatus.path === args.file?.relativePath)
      ? WorkspaceGitLocalChangesStatus.pending
      : WorkspaceGitLocalChangesStatus.synced;
  }

  return args.workspaceGitStatus.hasLocalChanges
    ? WorkspaceGitLocalChangesStatus.pending
    : WorkspaceGitLocalChangesStatus.synced;
};

export const resolveGitSyncStatus = (workspaceGitStatus?: WorkspaceGitStatusType) => {
  if (workspaceGitStatus === undefined) {
    return WorkspaceGitSyncStatus.unknown;
  }

  return workspaceGitStatus.isSynced ? WorkspaceGitSyncStatus.synced : WorkspaceGitSyncStatus.pending;
};

/**
 * Based on Git status, returns files that were removed from repository, but changes not yet commited.
 * @returns array of WorkspaceFile instances with empty file contents
 */
export const listDeletedFiles = (args: {
  workspaceDescriptor: WorkspaceDescriptor;
  workspaceGitStatus?: WorkspaceGitStatusType;
}) => {
  if (!args.workspaceGitStatus) {
    return [];
  }

  return args.workspaceGitStatus.fileStageStatuses
    .filter((stageStatus) => stageStatus.status === FileStageStatus.deleted)
    .map((status) => {
      return new WorkspaceFile({
        workspaceId: args.workspaceDescriptor.workspaceId,
        relativePath: status.path,
        getFileContents: () => Promise.resolve(new Uint8Array()),
      });
    });
};
