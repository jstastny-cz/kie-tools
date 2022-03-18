/*
 * Copyright 2019 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.kie.workbench.common.stunner.bpmn.service;

import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

import org.jboss.errai.common.client.api.annotations.Portable;

@Portable
public enum ProjectType {

    BPMN(null),
    CASE(".caseproject");

    ProjectType(String fileName) {
        this.fileName = fileName;
    }

    private String fileName;

    public static Optional<ProjectType> fromFileName(Optional<String> fileName) {
        return fileName.map(name -> Stream.of(ProjectType.values())
                .filter(v -> Objects.equals(v.fileName, name))
                .findFirst().orElse(null));
    }
}
