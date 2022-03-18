/*
 * Copyright 2016 Red Hat, Inc. and/or its affiliates.
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

package org.kie.workbench.common.forms.dynamic.client.rendering.renderers.selectors.listBox;

import javax.enterprise.context.Dependent;
import javax.inject.Inject;

import org.jboss.errai.databinding.client.api.Converter;
import org.jboss.errai.ui.client.local.spi.TranslationService;
import org.kie.workbench.common.forms.adf.rendering.Renderer;
import org.kie.workbench.common.forms.fields.shared.fieldTypes.basic.selectors.CharacterSelectorOption;
import org.kie.workbench.common.forms.fields.shared.fieldTypes.basic.selectors.listBox.definition.CharacterListBoxFieldDefinition;

@Dependent
@Renderer(fieldDefinition = CharacterListBoxFieldDefinition.class)
public class CharacterListBoxFieldRenderer
        extends AbstractListBoxFieldRenderer<CharacterListBoxFieldDefinition, CharacterSelectorOption, Character> {

    @Inject
    public CharacterListBoxFieldRenderer(TranslationService translationService) {
        super(translationService);
    }

    @Override
    public Character getEmptyValue() {
        return ' ';
    }

    @Override
    public Converter getConverter() {
        return null;
    }
}
