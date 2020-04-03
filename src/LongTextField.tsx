import React, { Ref } from 'react';
import { TextArea, TextAreaProps } from '@patternfly/react-core';

import { connectField } from './uniforms';

export type LongTextFieldProps = {
  onChange: (value?: any) => void;
  inputRef: Ref<TextArea>;
  value?: string;
  prefix?: string;
} & TextAreaProps;

const LongText = ({
  disabled,
  fieldId,
  inputRef,
  label,
  name,
  onChange,
  placeholder,
  value,
  ...props
}) => (
  <TextArea
    disabled={disabled}
    name={name}
    onChange={value => onChange(value)}
    placeholder={placeholder}
    ref={inputRef}
    value={value}
  />
);

export default connectField(LongText);
