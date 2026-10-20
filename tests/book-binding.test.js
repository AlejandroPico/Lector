import {it,expect} from 'vitest'
import {safeSettings} from '../src/storage.js'
import {portablePreferences} from '../src/sync-core.js'

it('recovers old preferences safely and exports only a supported binding preference',()=>{
  expect(safeSettings().bookBinding).toBe('hardcover')
  for(const value of ['hardcover','paperback','notebook'])expect(safeSettings({bookBinding:value}).bookBinding).toBe(value)
  for(const value of [null,'url(secret)',{},'spiral'])expect(safeSettings({bookBinding:value}).bookBinding).toBe('hardcover')
  expect(portablePreferences({bookBinding:'notebook',privateImage:'secret'})).toEqual({bookBinding:'notebook'})
  expect(safeSettings(portablePreferences({bookBinding:'unsafe'})).bookBinding).toBe('hardcover')
})
