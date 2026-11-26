import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/state/AppContext';
import { C, T } from './src/ui/theme';
import InicioScreen from './src/screens/InicioScreen';
import MuestrasScreen from './src/screens/MuestrasScreen';
import MuestraFormScreen from './src/screens/MuestraFormScreen';
import GaleriasScreen from './src/screens/GaleriasScreen';
import GaleriaFormScreen from './src/screens/GaleriaFormScreen';
import BocaminaScreen from './src/screens/BocaminaScreen';
import MapaScreen from './src/screens/MapaScreen';
import SeccionScreen from './src/screens/SeccionScreen';
import BloquesScreen from './src/screens/BloquesScreen';
import ParametrosScreen from './src/screens/ParametrosScreen';
import ResultadosScreen from './src/screens/ResultadosScreen';
import SyncScreen from './src/screens/SyncScreen';
import LegalScreen from './src/screens/LegalScreen';
import MasScreen from './src/screens/MasScreen';
import OperacionesScreen from './src/screens/OperacionesScreen';

export type RootStack = {
  Tabs: undefined;
  MuestraForm: { id?: string } | undefined;
  Galerias: undefined;
  GaleriaForm: { id?: string } | undefined;
  Bocamina: undefined;
  Mapa: undefined;
  Parametros: undefined;
  Resultados: undefined;
  Sync: undefined;
  Legal: undefined;
  Operaciones: undefined;
};

const Stack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator();

const icono = (s: string) => ({ color }: { color: string }) => <Text style={{ fontSize: 22, color }}>{s}</Text>;

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{
      tabBarStyle: { height: 72, paddingBottom: 10, borderTopWidth: 2, borderTopColor: C.borde },
      tabBarLabelStyle: { fontSize: 13, fontWeight: '800' }, tabBarActiveTintColor: C.primario, tabBarInactiveTintColor: C.texto,
      headerTitleStyle: { fontSize: T.l, fontWeight: '800' },
    }}>
      <Tab.Screen name="Inicio" component={InicioScreen} options={{ tabBarIcon: icono('⌂') }} />
      <Tab.Screen name="Muestras" component={MuestrasScreen} options={{ tabBarIcon: icono('＋') }} />
      <Tab.Screen name="Sección" component={SeccionScreen} options={{ tabBarIcon: icono('▤') }} />
      <Tab.Screen name="Bloques" component={BloquesScreen} options={{ tabBarIcon: icono('▦') }} />
      <Tab.Screen name="Más" component={MasScreen} options={{ tabBarIcon: icono('☰') }} />
    </Tab.Navigator>
  );
}

function Raiz() {
  const { listo } = useApp();
  if (!listo) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  return (
    <Stack.Navigator screenOptions={{ headerTitleStyle: { fontSize: T.l, fontWeight: '800' } }}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="MuestraForm" component={MuestraFormScreen} options={{ title: 'Muestra' }} />
      <Stack.Screen name="Galerias" component={GaleriasScreen} options={{ title: 'Galerías / niveles' }} />
      <Stack.Screen name="GaleriaForm" component={GaleriaFormScreen} options={{ title: 'Galería' }} />
      <Stack.Screen name="Bocamina" component={BocaminaScreen} options={{ title: 'Bocamina' }} />
      <Stack.Screen name="Mapa" component={MapaScreen} options={{ title: 'Mapa' }} />
      <Stack.Screen name="Parametros" component={ParametrosScreen} options={{ title: 'Parámetros' }} />
      <Stack.Screen name="Resultados" component={ResultadosScreen} options={{ title: 'Resultados' }} />
      <Stack.Screen name="Sync" component={SyncScreen} options={{ title: 'Sincronización' }} />
      <Stack.Screen name="Legal" component={LegalScreen} options={{ title: 'Advertencia y limitaciones' }} />
      <Stack.Screen name="Operaciones" component={OperacionesScreen} options={{ title: 'Operaciones' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Raiz />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
