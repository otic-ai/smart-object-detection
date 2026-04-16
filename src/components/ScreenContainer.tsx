/**
 * ScreenContainer — dark background SafeAreaView wrapper.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/appTheme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
};

export default function ScreenContainer({ children, style, noPadding }: Props) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
        !noPadding && styles.padding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  padding: {
    paddingHorizontal: 16,
  },
});
