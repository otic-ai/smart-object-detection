// Stub knowledge base — stands in for the Normalization layer output.
// Replace or extend this once the normalization layer is integrated.

import { KnownObject } from './types';

export const KNOWLEDGE_BASE: KnownObject[] = [
  {
    label: 'soft_drink',
    normalised_name: 'cola',
    aliases: ['coca cola', 'coke', 'coca-cola', 'pepsi', 'cola drink'],
    color: 'red',
    related_classes: ['bottle', 'can', 'cup', 'drink'],
  },
  {
    label: 'soft_drink',
    normalised_name: 'sprite',
    aliases: ['sprite', '7up', 'seven up', 'lemon soda'],
    color: 'green',
    related_classes: ['bottle', 'can', 'drink'],
  },
  {
    label: 'water',
    normalised_name: 'water_bottle',
    aliases: ['water', 'mineral water', 'aqua', 'h2o', 'evian', 'dasani'],
    color: 'blue',
    related_classes: ['bottle', 'container'],
  },
  {
    label: 'food',
    normalised_name: 'banana',
    aliases: ['banana', 'bananas'],
    color: 'yellow',
    related_classes: ['banana', 'fruit'],
  },
  {
    label: 'food',
    normalised_name: 'apple',
    aliases: ['apple', 'apples'],
    color: 'red',
    related_classes: ['apple', 'fruit'],
  },
  {
    label: 'electronics',
    normalised_name: 'smartphone',
    aliases: ['phone', 'mobile', 'iphone', 'android', 'smartphone'],
    color: 'black',
    related_classes: ['cell phone', 'mobile phone', 'smartphone'],
  },
  {
    label: 'electronics',
    normalised_name: 'laptop',
    aliases: ['laptop', 'notebook', 'macbook', 'computer'],
    color: 'black',
    related_classes: ['laptop', 'notebook', 'computer'],
  },
];
