import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function PrimaryButton({ label, onPress, variant = 'primary' }: Props) {
  return (
    <Pressable
      style={[styles.button, variant === 'secondary' && styles.secondary, variant === 'danger' && styles.danger]}
      onPress={onPress}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 8,
  },
  secondary: {
    backgroundColor: '#E5E7EB',
  },
  danger: {
    backgroundColor: '#EF4444',
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryLabel: {
    color: '#111827',
  },
});
