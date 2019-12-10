// tslint:disable: no-if-statement no-expression-statement no-let
import { createGraphAdapter } from '@chaingun/http-adapter'
import { GunGraphAdapter } from '@chaingun/types'
import {
  ExpressLikeRequest,
  ExpressLikeResponse,
  ExpressLikeStore,
  LinguaWebcaStore,
  PathPrefixedStore,
  SwitchingStore
} from '@lingua-webca/core'
import { parse as uriParse } from 'uri-js'

export function createSpecificStore(
  adapter: GunGraphAdapter
): LinguaWebcaStore {
  const app = new ExpressLikeStore()

  async function genericPut(
    req: ExpressLikeRequest,
    res: ExpressLikeResponse
  ): Promise<void> {
    const diff = await adapter.put(req.body)
    res.json(diff)
  }

  async function specificPut(
    req: ExpressLikeRequest,
    res: ExpressLikeResponse
  ): Promise<void> {
    const diff = await adapter.put({
      [req.params.soul]: req.body
    })
    res.json(diff)
  }

  app.get('*soul', async (req, res) => {
    const node = await adapter.get(decodeURI(req.params.soul))
    res.json(node)
  })

  app.patch('', genericPut)
  app.put('', genericPut)
  app.patch('*soul', specificPut)
  app.put('*soul', specificPut)

  return app.request
}

export function createGunStore(): LinguaWebcaStore {
  const storeCache: Record<string, LinguaWebcaStore> = {}

  return SwitchingStore.create(request => {
    const { scheme, host, port } = uriParse(request.uri)

    // tslint:disable-next-line: no-if-statement
    if (scheme !== 'gun') {
      return () =>
        Promise.resolve({
          body: `Invalid gun uri scheme ${scheme}`,
          code: 500,
          request,
          uri: request.uri
        })
    }

    // tslint:disable-next-line: no-if-statement
    if (!host) {
      return () =>
        Promise.resolve({
          body: `Invalid gun uri host ${host}`,
          code: 500,
          request,
          uri: request.uri
        })
    }

    const basePath = `${scheme}://${host}${port ? `:${port}` : ''}/`
    let store = storeCache[basePath]

    if (!store) {
      store = PathPrefixedStore.create(
        basePath,
        createSpecificStore(createGraphAdapter(`http://${host}/gun`))
      )

      // tslint:disable-next-line: no-object-mutation
      storeCache[basePath] = store
    }

    return store
  })
}

export const ChainGunLinguaStore = {
  create: createGunStore,
  createSpecific: createSpecificStore
}
